#!/usr/bin/env node
/**
 * Fails when the Flutter client and the API contract disagree.
 *
 * Doc 07 §3: "The Flutter side mirrors these via generated Dart models; drift
 * between the two is a bug, not a style preference." This makes that
 * enforceable rather than aspirational.
 *
 * Checks:
 *   1. Every wire field in the API's auth schemas exists on the Dart model.
 *   2. Every shared enum value in shared-types exists in its Dart mirror.
 *   3. Every ErrorCode in shared-types exists in ApiErrorCode.
 *
 * Deliberately does NOT require the reverse — Dart may declare paths and codes
 * the API has not built yet, which is normal while the backend is mid-plan.
 *
 *   node scripts/check-contract-drift.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const problems = [];

// ---------------------------------------------------------------------------
// 1. Auth wire fields
// ---------------------------------------------------------------------------
const spec = JSON.parse(read('apps/api/openapi.json'));
const dartModels = read('apps/mobile/lib/features/auth/data/models/auth_models.dart');

const SCHEMA_TO_MODEL = {
  PublicUserDto: 'AuthUserModel',
  AuthTokensDto: 'AuthTokensModel',
};

for (const [schemaName, modelName] of Object.entries(SCHEMA_TO_MODEL)) {
  const schema = spec.components?.schemas?.[schemaName];
  if (!schema) {
    problems.push(`OpenAPI schema ${schemaName} is missing — regenerate openapi.json`);
    continue;
  }

  const block = dartModels.split(`abstract class ${modelName}`)[1];
  if (!block) {
    problems.push(`Dart model ${modelName} not found`);
    continue;
  }

  const ctor = block.split('factory')[1]?.split('}')[0] ?? '';
  for (const field of Object.keys(schema.properties ?? {})) {
    if (!new RegExp(`\\b${field}\\b`).test(ctor)) {
      problems.push(`${modelName} is missing wire field "${field}" (from ${schemaName})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Shared enums
// ---------------------------------------------------------------------------
const sharedEnums = read('packages/shared-types/src/enums.ts');
const dartConstants = read('apps/mobile/lib/core/constants/app_constants.dart');

function tsEnumValues(name) {
  const block = sharedEnums.split(`export const ${name} = {`)[1]?.split('} as const;')[0];
  if (!block) return null;
  return [...block.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
}

const ENUM_MIRRORS = [
  { ts: 'Language', dart: dartConstants, dartEnum: 'AppLanguage' },
  { ts: 'Medium', dart: dartConstants, dartEnum: 'Medium' },
];

for (const { ts, dart, dartEnum } of ENUM_MIRRORS) {
  const values = tsEnumValues(ts);
  if (!values) {
    problems.push(`shared-types enum ${ts} not found`);
    continue;
  }

  const block = dart.split(`enum ${dartEnum} {`)[1]?.split('\n}')[0] ?? '';
  for (const value of values) {
    if (!block.includes(`'${value}'`)) {
      problems.push(`Dart enum ${dartEnum} is missing "${value}" (from ${ts})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Error codes
// ---------------------------------------------------------------------------
const sharedErrors = read('packages/shared-types/src/errors.ts');
const dartErrorCodes = read('apps/mobile/lib/core/errors/error_codes.dart');

const errorBlock =
  sharedErrors.split('export const ErrorCode = {')[1]?.split('} as const;')[0] ?? '';
const serverCodes = [...errorBlock.matchAll(/:\s*'([A-Z_]+)'/g)].map((m) => m[1]);

if (serverCodes.length === 0) {
  problems.push('Could not parse ErrorCode from shared-types');
}

for (const code of serverCodes) {
  if (!dartErrorCodes.includes(`'${code}'`)) {
    problems.push(`ApiErrorCode is missing "${code}"`);
  }
}

// ---------------------------------------------------------------------------
if (problems.length > 0) {
  console.error('Contract drift between apps/api and apps/mobile:\n');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error('\nUpdate the Dart side (or regenerate openapi.json) so the two agree.\n');
  process.exit(1);
}

console.log(
  `Contract OK — ${serverCodes.length} error codes, ` +
    `${Object.keys(SCHEMA_TO_MODEL).length} auth schemas, ` +
    `${ENUM_MIRRORS.length} enums mirrored.`,
);
