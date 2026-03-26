#!/usr/bin/env tsx
/**
 * Generate ApiIR JSON fixtures from OpenAPI fixtures under tests/compiler/fixtures.
 * Walks all nested directories except the top-level `apiir` output tree, mirroring each
 * `.yaml` / `.yml` / `.json` path into `apiir/<same-relative-path>.json`.
 *
 * Typical roots: demo/, valid-specs-github, valid-specs-api-guru, golden-candidates/<archetype>/ (after copy-golden-specs).
 *
 * Run after parse/validate/build changes. Commit updated ApiIR files.
 *
 * Usage: npm run fixtures:generate-apiir
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { parseOpenAPI } from '@/lib/compiler/openapi/parser';
import { validateSubset } from '@/lib/compiler/openapi/subset-validator';
import { resolveRefs } from '@/lib/compiler/openapi/ref-resolver';
import { buildApiIR } from '@/lib/compiler/apiir';
import { openapiFixtureRelToApiirRel, walkOpenapiFixtureRelPaths } from './fixture-openapi-walk';

const FIXTURES_DIR = join(process.cwd(), 'tests/compiler/fixtures');

function processOne(relPath: string): boolean {
  const inputPath = join(FIXTURES_DIR, relPath);
  const outputPath = join(FIXTURES_DIR, openapiFixtureRelToApiirRel(relPath));

  const content = readFileSync(inputPath, 'utf-8');
  const parseResult = parseOpenAPI(content);

  if (!parseResult.success) {
    console.error(`[${relPath}] Parse failed: ${parseResult.error.message}`);
    return false;
  }

  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) {
    console.error(
      `[${relPath}] Validation failed: ${validateResult.errors.map((e) => e.message).join('; ')}`
    );
    return false;
  }

  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) {
    console.error(`[${relPath}] Resolve failed: ${resolveResult.error.message}`);
    return false;
  }

  const buildResult = buildApiIR(resolveResult.doc);
  if (!buildResult.success) {
    console.error(`[${relPath}] Build failed: ${buildResult.error.message}`);
    return false;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(buildResult.apiIr, null, 2));
  console.log(`Generated: ${outputPath}`);
  return true;
}

function main() {
  if (!existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  let processed = 0;
  walkOpenapiFixtureRelPaths(FIXTURES_DIR, (rel) => {
    if (processOne(rel)) processed++;
  });

  if (processed === 0) {
    console.log('No OpenAPI fixtures found (excluding invalid).');
    process.exit(0);
  }

  console.log(`Done. ${processed} fixture(s) processed.`);
}

main();
