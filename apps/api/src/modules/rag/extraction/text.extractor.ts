import { Injectable } from '@nestjs/common';
import type { ExtractedPage, ExtractionResult, Extractor } from './extractor.interface';

/**
 * Plain text and Markdown.
 *
 * Useful beyond convenience: it is how a chapter gets into the corpus when
 * the PDF is unusable. Doc 07 R-01's mitigation budgets "manual
 * transcription of two chapters if needed", and this is the path that
 * transcription takes.
 */
@Injectable()
export class PlainTextExtractor implements Extractor {
  readonly name = 'plaintext';

  supports(mimeType: string): boolean {
    return mimeType === 'text/plain' || mimeType === 'text/markdown';
  }

  async extract(file: Buffer): Promise<ExtractionResult> {
    const text = file.toString('utf8');
    const pages = splitIntoPages(text);

    return {
      pages,
      pageCount: pages.length,
      ocrRequiredPages: [],
      extractor: this.name,
    };
  }
}

/**
 * Splits on form feeds or an explicit `--- page N ---` marker, falling back
 * to one page for the whole file.
 *
 * A transcriber marking page boundaries gets page numbers on their chunks,
 * which is what lets the admin panel point at a physical page when a student
 * reports a wrong answer.
 */
export function splitIntoPages(text: string): ExtractedPage[] {
  const marker = /\n?-{2,}\s*page\s+(\d+)\s*-{2,}\n?/giu;

  if (text.includes('\f')) {
    return text
      .split('\f')
      .map((page, index) => ({ pageNumber: index + 1, text: page.trim(), needsOcr: false }))
      .filter((page) => page.text.length > 0);
  }

  const matches = [...text.matchAll(marker)];
  if (matches.length > 0) {
    const pages: ExtractedPage[] = [];

    for (const [index, match] of matches.entries()) {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? text.length;
      const body = text.slice(start, end).trim();

      if (body.length > 0) {
        pages.push({
          pageNumber: Number.parseInt(match[1] ?? String(index + 1), 10),
          text: body,
          section: detectHeading(body),
          needsOcr: false,
        });
      }
    }

    if (pages.length > 0) return pages;
  }

  const trimmed = text.trim();
  return trimmed.length === 0
    ? []
    : [{ pageNumber: 1, text: trimmed, section: detectHeading(trimmed), needsOcr: false }];
}

/** A Markdown heading on the first line becomes the section. */
function detectHeading(text: string): string | undefined {
  const first = text.split('\n', 1)[0]?.trim() ?? '';
  const heading = /^#{1,3}\s+(.{3,200})$/u.exec(first);
  return heading?.[1]?.trim();
}
