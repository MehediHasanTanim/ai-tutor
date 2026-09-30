/**
 * Text extraction — doc 07 Weeks 3–4.
 *
 * "Bangla PDF text extraction is the hard part. Budget real time for it.
 * Expect to need OCR fallback for scanned or image-based pages."
 *
 * The interface separates *getting text off the page* from everything
 * downstream. Extraction is the step most likely to be replaced — R-02 says
 * the extractor has to be chosen by testing conjunct fidelity on real NCTB
 * files, and that test can only be run once there is something to test.
 */

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  /**
   * Detected section heading, when the layout makes one identifiable.
   * Chunking uses this as a hard boundary.
   */
  section?: string;
  /**
   * True when the page yielded no usable text layer — a scan or a
   * photographed page. These are the pages that need OCR.
   */
  needsOcr: boolean;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  pageCount: number;
  /** Pages with no text layer. Non-empty means the document needs OCR. */
  ocrRequiredPages: number[];
  /** What produced this, for the document record and for debugging. */
  extractor: string;
}

export interface Extractor {
  readonly name: string;
  supports(mimeType: string): boolean;
  extract(file: Buffer): Promise<ExtractionResult>;
}

/**
 * OCR for pages with no text layer.
 *
 * Separate from `Extractor` because it is a different decision (D-10) with
 * a different provider, and because it is per-page rather than per-document:
 * an NCTB chapter is commonly a text PDF with three scanned diagram pages.
 */
export interface OcrProvider {
  readonly name: string;
  /** Renders and reads one page. Returns the recognised text. */
  recognizePage(params: {
    image: Buffer;
    mediaType: 'image/png' | 'image/jpeg';
    /** Hint; the page may be mixed script regardless. */
    language: 'bn' | 'en' | 'mixed';
  }): Promise<{ text: string; confidence: number }>;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly kind: 'unsupported' | 'no_text_layer' | 'corrupt' | 'ocr_required',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ExtractionError';
  }
}
