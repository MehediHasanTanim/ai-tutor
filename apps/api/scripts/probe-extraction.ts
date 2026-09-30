#!/usr/bin/env ts-node
/**
 * Extraction quality probe.
 *
 *   pnpm --filter @ai-tutor/api probe:extraction path/to/chapter.pdf
 *
 * Runs a file through extraction, normalization and conjunct repair, and
 * reports whether the result is ingestable — without needing a hand
 * transcription to compare against.
 *
 * This is the tool doc 07 R-02 needs. The risk says Bangla PDF extraction
 * producing corrupted text is *high likelihood*, and the mitigation is to
 * "test extraction in Week 1, not Week 3". Testing it means running a real
 * NCTB PDF through this and reading the numbers, before anyone commits to
 * an extractor or a content source (D-08).
 *
 * Orphaned combining marks and dangling viramas cannot occur in correctly
 * ordered Bengali, so a non-zero count is evidence of corruption rather
 * than a matter of opinion.
 */

import '../src/load-env';

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PdfExtractor } from '../src/modules/rag/extraction/pdf.extractor';
import { PlainTextExtractor } from '../src/modules/rag/extraction/text.extractor';
import { assessBanglaQuality, repairBanglaText } from '../src/modules/rag/normalization/bangla';
import { chunkBlocks } from '../src/modules/rag/chunking';
import type { Extractor } from '../src/modules/rag/extraction/extractor.interface';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: probe:extraction <file.pdf|file.txt> [--show-text]');
    process.exit(1);
  }

  const absolute = resolve(path);
  if (!existsSync(absolute)) {
    console.error(`No such file: ${absolute}`);
    process.exit(1);
  }

  const showText = process.argv.includes('--show-text');
  const file = readFileSync(absolute);
  const mimeType = absolute.endsWith('.pdf') ? 'application/pdf' : 'text/plain';

  const extractors: Extractor[] = [new PdfExtractor(), new PlainTextExtractor()];
  const extractor = extractors.find((candidate) => candidate.supports(mimeType));
  if (!extractor) {
    console.error(`No extractor handles "${mimeType}"`);
    process.exit(1);
  }

  console.log(`\nFile      ${absolute}`);
  console.log(`Size      ${(file.byteLength / 1024).toFixed(0)} KB`);
  console.log(`Extractor ${extractor.name}\n`);

  const result = await extractor.extract(file);

  console.log(`Pages              ${result.pageCount}`);
  console.log(
    `Pages needing OCR  ${result.ocrRequiredPages.length}` +
      (result.ocrRequiredPages.length > 0
        ? `  (${result.ocrRequiredPages.slice(0, 15).join(', ')})`
        : ''),
  );

  const rawText = result.pages.map((page) => page.text).join('\n\n');
  if (rawText.trim().length === 0) {
    console.log('\nNo text extracted. This is a scanned PDF — it needs OCR (R-02).');
    process.exit(2);
  }

  const before = assessBanglaQuality(rawText);
  const repaired = repairBanglaText(rawText);
  const after = assessBanglaQuality(repaired.text);

  console.log(`\n${'─'.repeat(64)}`);
  console.log('Bangla quality            before      after');
  console.log('─'.repeat(64));
  row('Bengali character ratio', pct(before.bengaliRatio), pct(after.bengaliRatio));
  row('Orphaned combining marks', before.orphanedMarks, after.orphanedMarks);
  row('Dangling viramas', before.danglingViramas, after.danglingViramas);
  row('Replacement chars (U+FFFD)', before.replacementChars, after.replacementChars);
  row('Short-fragment ratio', pct(before.shortFragmentRatio), pct(after.shortFragmentRatio));
  row('Ingestable', before.usable ? 'yes' : 'NO', after.usable ? 'yes' : 'NO');

  if (after.warnings.length > 0) {
    console.log('\n  Warnings:');
    for (const warning of after.warnings) console.log(`    · ${warning}`);
  }

  console.log(`\n${'─'.repeat(64)}`);
  console.log('Repairs applied');
  console.log('─'.repeat(64));
  for (const [name, count] of Object.entries(repaired.repairs)) {
    console.log(`  ${name.padEnd(28)} ${count}`);
  }

  const blocks = result.pages.flatMap((page) =>
    repairBanglaText(page.text)
      .text.split(/\n{2,}/u)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => ({
        text: paragraph,
        pageNumber: page.pageNumber,
        section: page.section,
      })),
  );
  const chunks = chunkBlocks(blocks);

  console.log(`\n${'─'.repeat(64)}`);
  console.log('Chunking');
  console.log('─'.repeat(64));
  console.log(`  chunks                       ${chunks.length}`);
  if (chunks.length > 0) {
    const tokens = chunks.map((chunk) => chunk.tokenCount);
    console.log(
      `  tokens min/median/max        ${Math.min(...tokens)} / ${median(tokens)} / ${Math.max(...tokens)}`,
    );
    console.log(
      `  sections detected            ${new Set(chunks.map((c) => c.section).filter(Boolean)).size}`,
    );
  }

  if (showText) {
    console.log(`\n${'─'.repeat(64)}`);
    console.log('Repaired text (first 1500 chars)');
    console.log('─'.repeat(64));
    console.log(repaired.text.slice(0, 1500));
  }

  console.log();
  if (!after.usable) {
    console.log('VERDICT: NOT ingestable. The extractor mangled the conjuncts.');
    console.log('Try a different extractor, or OCR the pages, before committing to this source.');
    process.exit(3);
  }

  if (after.suspicious) {
    console.log('VERDICT: ingestable, but suspicious — have a native reader look before');
    console.log('committing to this extractor or content source (D-08).');
  } else {
    console.log('VERDICT: ingestable.');
  }

  console.log(
    '\nThis checks structural integrity, not meaning. It cannot detect an extractor\n' +
      'that silently drops characters while leaving each fragment well-formed, so a\n' +
      'native reader must still spot-check the text against the page — which is what\n' +
      "doc 07's Weeks 3–4 exit criteria require.",
  );
}

function row(label: string, before: string | number, after: string | number): void {
  console.log(`  ${label.padEnd(26)} ${String(before).padStart(8)}   ${String(after).padStart(8)}`);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
