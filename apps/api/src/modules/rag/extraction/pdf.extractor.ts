import { Injectable, Logger } from '@nestjs/common';
import {
  ExtractionError,
  type ExtractedPage,
  type ExtractionResult,
  type Extractor,
} from './extractor.interface';

/**
 * PDF extraction via pdf.js.
 *
 * pdf.js over the simpler `pdf-parse` family because it exposes per-item
 * positions, and position is what makes three necessary things possible:
 *
 *   - **Header/footer removal** by Y band, rather than by guessing at the
 *     text. A regex that strips "Chapter 3" also strips it from a sentence.
 *   - **Two-column detection**, which NCTB pages use. Reading a two-column
 *     page in raw item order interleaves the columns line by line and
 *     produces fluent-looking nonsense.
 *   - **Scanned-page detection**: a page with no text items needs OCR, and
 *     that has to be known per page, not per document.
 */
@Injectable()
export class PdfExtractor implements Extractor {
  readonly name = 'pdfjs';
  private readonly logger = new Logger(PdfExtractor.name);

  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  async extract(file: Buffer): Promise<ExtractionResult> {
    const pdfjs = await loadPdfJs();

    let document;
    try {
      document = await pdfjs.getDocument({
        data: new Uint8Array(file),
        // Fonts and system fonts are irrelevant to text extraction and
        // trigger filesystem lookups that fail in a container.
        disableFontFace: true,
        useSystemFonts: false,
        isEvalSupported: false,
      }).promise;
    } catch (error) {
      throw new ExtractionError('Could not open the PDF', 'corrupt', { cause: error });
    }

    const pages: ExtractedPage[] = [];
    const ocrRequiredPages: number[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();

        const items = content.items
          .filter((item: unknown): item is TextItem => isTextItem(item))
          .map((item) => ({
            text: item.str,
            x: item.transform[4] ?? 0,
            y: item.transform[5] ?? 0,
            width: item.width ?? 0,
            height: item.height ?? 0,
          }));

        const meaningful = items.filter((item) => item.text.trim().length > 0);

        if (meaningful.length === 0) {
          // No text layer. Almost always a scan; occasionally a page that is
          // entirely a diagram, which OCR will correctly find little on.
          pages.push({ pageNumber, text: '', needsOcr: true });
          ocrRequiredPages.push(pageNumber);
          continue;
        }

        const text = assemblePage(meaningful, viewport.width, viewport.height);
        pages.push({ pageNumber, text, section: detectSection(meaningful), needsOcr: false });
      }
    } finally {
      await document.destroy();
    }

    if (ocrRequiredPages.length > 0) {
      this.logger.warn(
        `${ocrRequiredPages.length} of ${document.numPages} pages have no text layer ` +
          `and need OCR: ${ocrRequiredPages.slice(0, 10).join(', ')}` +
          (ocrRequiredPages.length > 10 ? '…' : ''),
      );
    }

    return {
      pages,
      pageCount: document.numPages,
      ocrRequiredPages,
      extractor: this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface PositionedItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Header and footer bands, as a fraction of page height.
 *
 * Positional rather than textual on purpose: doc 07 asks to "strip
 * headers/footers/page numbers", and a text rule that removes "১২" removes
 * it from the middle of a worked example too.
 */
const HEADER_BAND = 0.94;
const FOOTER_BAND = 0.06;

/** Items within this vertical distance are treated as one line. */
const LINE_TOLERANCE = 3;

export function assemblePage(
  items: PositionedItem[],
  pageWidth: number,
  pageHeight: number,
): string {
  const body = items.filter((item) => {
    const relativeY = item.y / pageHeight;
    return relativeY < HEADER_BAND && relativeY > FOOTER_BAND;
  });

  if (body.length === 0) return '';

  const columns = splitColumns(body, pageWidth);
  return columns
    .map((column) => linesOf(column))
    .flat()
    .join('\n');
}

/**
 * Detects a two-column layout and returns each column's items separately.
 *
 * The test is a gap in the horizontal distribution around the page midline.
 * If items straddle the middle, it is a single column and we return one
 * group — reading a single-column page as two would be worse than the bug
 * this prevents.
 */
export function splitColumns(items: PositionedItem[], pageWidth: number): PositionedItem[][] {
  const midpoint = pageWidth / 2;
  const gutter = pageWidth * 0.04;

  const straddling = items.filter(
    (item) => item.x < midpoint - gutter && item.x + item.width > midpoint + gutter,
  );

  // Any full-width line (a heading, a table) means this is not two columns.
  if (straddling.length > 0) return [items];

  const left = items.filter((item) => item.x + item.width <= midpoint + gutter);
  const right = items.filter((item) => item.x >= midpoint - gutter);

  // Both sides must carry real content; otherwise it is one narrow column.
  const minimumShare = items.length * 0.15;
  if (left.length < minimumShare || right.length < minimumShare) return [items];

  return [left, right];
}

/** Groups items into lines by Y, then orders each line left to right. */
function linesOf(items: PositionedItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PositionedItem[][] = [];
  for (const item of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs((current[0]?.y ?? 0) - item.y) <= LINE_TOLERANCE) {
      current.push(item);
    } else {
      lines.push([item]);
    }
  }

  const rendered: string[] = [];
  let previousY: number | undefined;
  let previousHeight = 0;

  for (const line of lines) {
    const ordered = [...line].sort((a, b) => a.x - b.x);
    const text = joinLine(ordered);
    if (text.trim().length === 0) continue;

    // A vertical gap larger than a line height is a paragraph break, which
    // chunking relies on to find block boundaries.
    const y = ordered[0]!.y;
    if (previousY !== undefined && previousY - y > previousHeight * 1.8) {
      rendered.push('');
    }

    rendered.push(text);
    previousY = y;
    previousHeight = ordered[0]!.height || previousHeight;
  }

  return rendered;
}

/**
 * Joins items on a line, inserting a space only where the gap warrants one.
 *
 * pdf.js splits a line into items at font and kerning changes, which in
 * mixed Bangla/English text happens mid-word — exactly where a naive
 * space-join would break "photosynthesis" into two words, or worse, split a
 * Bengali conjunct across items.
 */
function joinLine(items: PositionedItem[]): string {
  let result = '';
  let previousEnd: number | undefined;

  for (const item of items) {
    if (previousEnd !== undefined) {
      const gap = item.x - previousEnd;
      // Roughly a quarter of a character width. Below that the split is a
      // font change, not a word boundary.
      if (gap > item.height * 0.25) result += ' ';
    }
    result += item.text;
    previousEnd = item.x + item.width;
  }

  return result;
}

/**
 * Guesses the section heading: the largest text in the top third of the page.
 *
 * Used as a chunk boundary, so a wrong guess costs a suboptimal split rather
 * than corrupted content. Returns undefined when nothing stands out.
 */
function detectSection(items: PositionedItem[]): string | undefined {
  if (items.length === 0) return undefined;

  const maxY = Math.max(...items.map((item) => item.y));
  const minY = Math.min(...items.map((item) => item.y));
  const topThird = maxY - (maxY - minY) / 3;

  const candidates = items.filter((item) => item.y >= topThird && item.text.trim().length > 3);
  if (candidates.length === 0) return undefined;

  const largest = candidates.reduce((a, b) => (b.height > a.height ? b : a));
  const bodyHeight = median(items.map((item) => item.height));

  // Must be meaningfully larger than body text to count as a heading.
  if (largest.height < bodyHeight * 1.25) return undefined;

  return largest.text.trim().slice(0, 200);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

// ---------------------------------------------------------------------------
// pdf.js interop
// ---------------------------------------------------------------------------

interface TextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

function isTextItem(item: unknown): item is TextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as TextItem).str === 'string'
  );
}

/**
 * pdf.js ships ESM only while this app compiles to CommonJS.
 *
 * A plain `import()` does not survive: TypeScript downlevels it to
 * `require()` under `module: commonjs`, which throws ERR_REQUIRE_ESM at
 * runtime. Going through the Function constructor keeps a genuine dynamic
 * import in the emitted JavaScript.
 *
 * Cached because pdf.js is not cheap to initialise and the worker would
 * otherwise load it once per document.
 */
const importEsm = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<unknown>;

let pdfJsModule: Promise<PdfJsModule> | undefined;

interface PdfJsModule {
  getDocument(options: Record<string, unknown>): { promise: Promise<PdfDocument> };
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

interface PdfPage {
  getViewport(options: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
}

async function loadPdfJs(): Promise<PdfJsModule> {
  pdfJsModule ??= importEsm('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfJsModule>;
  return pdfJsModule;
}
