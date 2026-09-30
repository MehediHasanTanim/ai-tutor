import { Injectable, Logger, Optional } from '@nestjs/common';
import { repairBanglaText, assessBanglaQuality, type BanglaQuality } from '../normalization/bangla';
import {
  ExtractionError,
  type ExtractedPage,
  type ExtractionResult,
  type Extractor,
  type OcrProvider,
} from './extractor.interface';
import { PdfExtractor } from './pdf.extractor';
import { PlainTextExtractor } from './text.extractor';

export interface NormalizedDocument {
  pages: ExtractedPage[];
  pageCount: number;
  extractor: string;
  /** Pages that needed OCR and did not get it. Their text is empty. */
  unreadablePages: number[];
  /** Repairs applied across the document, for the ingestion log. */
  repairs: Record<string, number>;
  quality: BanglaQuality;
}

/**
 * Extraction and normalization — the first two stages of the pipeline.
 *
 *   upload → **text extraction → normalization** → chunking → embedding
 *
 * Routes by MIME to an extractor, sends text-layer-free pages to OCR when a
 * provider exists, then repairs and scores the result before anything
 * downstream sees it.
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly extractors: Extractor[];

  constructor(
    pdf: PdfExtractor,
    text: PlainTextExtractor,
    /**
     * Absent until D-10 is decided. Optional rather than required so the
     * pipeline runs on text-layer PDFs today and gains scanned-page support
     * by registering a provider — no change here.
     */
    @Optional() private readonly ocr?: OcrProvider,
  ) {
    this.extractors = [pdf, text];
  }

  async extract(file: Buffer, mimeType: string): Promise<NormalizedDocument> {
    const extractor = this.extractors.find((candidate) => candidate.supports(mimeType));
    if (!extractor) {
      throw new ExtractionError(`No extractor handles "${mimeType}"`, 'unsupported');
    }

    const raw = await extractor.extract(file);
    const withOcr = await this.fillScannedPages(raw, file);

    return this.normalize(withOcr);
  }

  /**
   * Runs OCR over pages with no text layer.
   *
   * Without a provider the pages stay empty and are reported as unreadable
   * rather than silently dropped: a chapter whose worked examples were all
   * on scanned pages would otherwise ingest as "successful" and retrieve
   * nothing when a student asks about them.
   */
  private async fillScannedPages(
    result: ExtractionResult,
    _file: Buffer,
  ): Promise<ExtractionResult> {
    if (result.ocrRequiredPages.length === 0) return result;

    if (!this.ocr) {
      this.logger.warn(
        `${result.ocrRequiredPages.length} page(s) need OCR but no provider is ` +
          'registered (D-10 is open). Those pages will be empty.',
      );
      return result;
    }

    // Rendering a PDF page to an image needs a canvas backend, which is a
    // native dependency this app does not yet carry. Deliberately not
    // stubbed: an OCR path that silently returns nothing looks identical to
    // one that works on a page with little text.
    throw new ExtractionError(
      `${result.ocrRequiredPages.length} page(s) have no text layer. An OCR provider ` +
        'is registered but page rasterisation is not implemented — see doc 07 Weeks 7–8.',
      'ocr_required',
    );
  }

  /**
   * Normalization — doc 07 Weeks 3–4.
   *
   * Unicode normalization, artefact removal and conjunct repair, plus a
   * quality score so a mangled extraction is caught here rather than
   * discovered by a student reading a garbled explanation.
   */
  private normalize(result: ExtractionResult): NormalizedDocument {
    const totals: Record<string, number> = {
      reorderedPreBaseVowels: 0,
      recombinedSplitVowels: 0,
      repairedViramaSpacing: 0,
      strippedArtefacts: 0,
    };

    const pages = result.pages.map((page) => {
      if (page.text.trim().length === 0) return page;

      const repaired = repairBanglaText(page.text);
      for (const [key, count] of Object.entries(repaired.repairs)) {
        totals[key] = (totals[key] ?? 0) + count;
      }

      return { ...page, text: stripStructuralNoise(repaired.text) };
    });

    const combined = pages.map((page) => page.text).join('\n\n');
    const quality = assessBanglaQuality(combined);

    const repairCount = Object.values(totals).reduce((sum, value) => sum + value, 0);
    if (repairCount > 0) {
      this.logger.log(
        `Repaired Bangla text: ${Object.entries(totals)
          .filter(([, count]) => count > 0)
          .map(([key, count]) => `${key}=${count}`)
          .join(', ')}`,
      );
    }

    return {
      pages,
      pageCount: result.pageCount,
      extractor: result.extractor,
      unreadablePages: result.ocrRequiredPages,
      repairs: totals,
      quality,
    };
  }
}

/**
 * Removes what survived positional header/footer stripping.
 *
 * Positional filtering catches headers by where they sit; this catches the
 * rest — a bare page number on its own line in either numeral system, and
 * runs of dot leaders from a contents page.
 */
export function stripStructuralNoise(text: string): string {
  return text
    .replace(/^\s*[\d০-৯]{1,4}\s*$/gmu, '')
    .replace(/\.{4,}/gu, ' ')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}
