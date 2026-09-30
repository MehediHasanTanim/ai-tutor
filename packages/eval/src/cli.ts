#!/usr/bin/env node
/**
 * Evaluation CLI.
 *
 *   pnpm eval:chat        run the chat suite (D-09)
 *   pnpm eval:embedding   run the retrieval probes (D-11)
 *   pnpm eval:sheet       emit the blind Bangla review sheet
 *   pnpm eval validate    check the datasets without spending anything
 *
 * `validate` runs without credentials and without cost, and is the thing to
 * run after editing a dataset.
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { loadChatDataset, loadEmbeddingDataset } from './datasets/loader.js';
import { loadVisionDataset } from './datasets/vision-loader.js';
import { buildCandidates } from './providers/registry.js';
import { runChatSuite } from './runners/chat.js';
import { buildReviewSheet, renderSheetMarkdown } from './review/sheet.js';
import { renderEvaluationReport } from './report/markdown.js';
import { projectMonthlyCost, type PricingTable } from './metrics/cost.js';
import type { MonthlyProjection } from './metrics/cost.js';
import type { RunReport } from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..');
const RESULTS_DIR = resolve(PACKAGE_ROOT, 'results');

interface PricingFile {
  models: Record<
    string,
    { inputPerMTok: number; outputPerMTok: number; cachedInputPerMTok?: number; verifiedOn: string }
  >;
  projection: {
    questionsPerDay: number;
    usdToBdt: number;
    premiumPriceBdt: number;
    budgetShare: number;
  };
}

function loadPricing(): PricingFile {
  return JSON.parse(readFileSync(resolve(PACKAGE_ROOT, 'pricing.json'), 'utf8')) as PricingFile;
}

async function main(): Promise<void> {
  const [command = 'help', ...rest] = process.argv.slice(2);

  switch (command) {
    case 'validate':
      return validate();
    case 'chat':
      return chat(rest);
    case 'embedding':
      return embedding();
    case 'review-sheet':
      return reviewSheet(rest);
    default:
      return help();
  }
}

function help(): void {
  console.log(
    [
      'ai-tutor-eval — decides D-09, D-10 and D-11 by measurement (doc 07 §6)',
      '',
      '  validate       check datasets; no credentials, no cost',
      '  chat           run the chat suite against every registered candidate',
      '  embedding      run the Bangla retrieval probes',
      '  review-sheet   emit the blind Bangla fluency review sheet from a run',
      '',
      'Flags:',
      '  --only <id,id>   restrict to named candidates',
      '  --run <id>       which run to read (review-sheet)',
    ].join('\n'),
  );
}

/** Dataset health check. Runs offline. */
function validate(): void {
  let problems = 0;

  const chatData = loadChatDataset();
  console.log(`chat: ${chatData.cases.length} cases (target ${chatData.targetSize})`);
  for (const warning of chatData.warnings) {
    console.warn(`  ! ${warning}`);
    problems += 1;
  }

  const embeddingData = loadEmbeddingDataset();
  console.log(
    `embedding: ${embeddingData.probes.length} probes over ${embeddingData.chunks.length} chunks`,
  );
  for (const warning of embeddingData.warnings) {
    console.warn(`  ! ${warning}`);
    problems += 1;
  }

  const visionData = loadVisionDataset();
  console.log(
    `vision: ${visionData.cases.length} photos (target ${visionData.targetSize})` +
      `${visionData.usable ? '' : ' — not yet usable for D-10'}`,
  );
  for (const warning of visionData.warnings) {
    console.warn(`  ! ${warning}`);
    problems += 1;
  }

  const pricing = loadPricing();
  const stale = Object.entries(pricing.models).filter(([, entry]) => {
    const age = Date.now() - new Date(entry.verifiedOn).getTime();
    return age > 90 * 24 * 60 * 60 * 1000;
  });
  for (const [model] of stale) {
    console.warn(`  ! pricing for "${model}" was last verified over 90 days ago`);
    problems += 1;
  }

  console.log(
    problems === 0
      ? '\nDatasets are clean.'
      : `\n${problems} warning(s). These do not block a run, but they qualify its conclusions.`,
  );
}

async function chat(args: string[]): Promise<void> {
  const only = flagValue(args, '--only')?.split(',');
  const dataset = loadChatDataset();
  const pricingFile = loadPricing();

  for (const warning of dataset.warnings) console.warn(`! ${warning}`);

  const candidates = buildCandidates({
    pricing: pricingFile.models as PricingTable,
    only,
  });

  if (candidates.length === 0) {
    console.error(
      '\nNo candidates available. Set credentials (`ant auth login` or ANTHROPIC_API_KEY) ' +
        'and add candidates in src/providers/registry.ts.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nRunning ${candidates.length} candidate(s) over ${dataset.cases.length} cases.`);
  console.warn('This spends real money. Ctrl-C now if that was not intended.\n');

  const startedAt = new Date().toISOString();
  const { results, summaries } = await runChatSuite({
    cases: dataset.cases,
    candidates,
    onProgress: (done, total, label) => {
      process.stdout.write(`\r  ${done}/${total}  ${label.padEnd(50).slice(0, 50)}`);
    },
  });
  process.stdout.write('\n');

  const report: RunReport = {
    runId: randomUUID().slice(0, 8),
    startedAt,
    finishedAt: new Date().toISOString(),
    suite: 'chat',
    datasetVersion: dataset.version,
    candidates: summaries,
    results,
    unreviewedCaseIds: dataset.cases.filter((c) => !c.reviewed).map((c) => c.id),
  };

  const projections: Record<string, MonthlyProjection> = {};
  for (const summary of summaries) {
    projections[summary.candidateId] = projectMonthlyCost({
      costPerQuestionUsd: summary.cost.perQuestionUsd,
      ...pricingFile.projection,
    });
  }

  writeRun(report);

  const markdown = renderEvaluationReport({ report, projections, humanReviewComplete: false });
  const reportPath = resolve(PACKAGE_ROOT, '../../docs/architecture/07a_AI_Provider_Evaluation.md');
  writeFileSync(reportPath, markdown, 'utf8');

  console.log(`\nRun ${report.runId} complete.`);
  console.log(`  results  packages/eval/results/${report.runId}.json`);
  console.log(`  report   docs/architecture/07a_AI_Provider_Evaluation.md`);
  console.log('\nNext: `pnpm eval:sheet --run ' + report.runId + '` for the Bangla review.');
}

async function embedding(): Promise<void> {
  const dataset = loadEmbeddingDataset();
  for (const warning of dataset.warnings) console.warn(`! ${warning}`);

  console.log(`\n${dataset.probes.length} probes over ${dataset.chunks.length} chunks are ready.`);
  console.error(
    '\nNo embedding candidate is registered yet. D-11 needs at least two multilingual\n' +
      'models to compare — implement EvalCandidate.embed for each and register them in\n' +
      'src/providers/registry.ts. The scoring side (recall@k, MRR, hard-negative\n' +
      'confusion) is implemented and tested in src/metrics/retrieval.ts.',
  );
  process.exitCode = 1;
}

function reviewSheet(args: string[]): void {
  const runId = flagValue(args, '--run');
  if (!runId) {
    console.error('Pass --run <id>. Run ids are the filenames in packages/eval/results/.');
    process.exitCode = 1;
    return;
  }

  const report = JSON.parse(
    readFileSync(resolve(RESULTS_DIR, `${runId}.json`), 'utf8'),
  ) as RunReport;

  const dataset = loadChatDataset();
  const lookup = (caseId: string, language: string): string => {
    const testCase = dataset.cases.find((entry) => entry.id === caseId);
    return testCase?.prompts[language as 'bn' | 'en' | 'banglish'] ?? '(question not found)';
  };

  const { sheet, key } = buildReviewSheet(report.results, lookup);

  mkdirSync(RESULTS_DIR, { recursive: true });
  const sheetPath = resolve(RESULTS_DIR, `${runId}-review-sheet.md`);
  const keyPath = resolve(RESULTS_DIR, `${runId}-review-key.json`);

  writeFileSync(sheetPath, renderSheetMarkdown(sheet), 'utf8');
  writeFileSync(keyPath, JSON.stringify(key, null, 2), 'utf8');

  console.log(`Review sheet: ${sheetPath}`);
  console.log(`Answer key:   ${keyPath}`);
  console.log(
    '\nSend the reviewer the sheet only. It is blinded on purpose — doc 07 D-09 requires\n' +
      'the decision be made on measured Bangla quality, not on which vendor wrote it.',
  );
}

function writeRun(report: RunReport): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    resolve(RESULTS_DIR, `${report.runId}.json`),
    JSON.stringify(report, null, 2),
    'utf8',
  );
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
