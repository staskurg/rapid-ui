#!/usr/bin/env tsx
/**
 * Verify that ApiIR JSON fixtures match what the pipeline produces.
 * Run: npm run verify:apiir-fixtures
 *
 * Sources mirror {@link scripts/generate-apiir-fixtures.ts}: every OpenAPI file under
 * tests/compiler/fixtures except the top-level `apiir` tree, with mirrored paths under
 * `apiir/` (same relative path, `.json` extension).
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseOpenAPI } from '@/lib/compiler/openapi/parser';
import { validateSubset } from '@/lib/compiler/openapi/subset-validator';
import { resolveRefs } from '@/lib/compiler/openapi/ref-resolver';
import { buildApiIR, apiIrStringify } from '@/lib/compiler/apiir';
import { openapiFixtureRelToApiirRel, walkOpenapiFixtureRelPaths } from './fixture-openapi-walk';

const FIXTURES_DIR = join(process.cwd(), 'tests/compiler/fixtures');

function main() {
  let allMatch = true;

  walkOpenapiFixtureRelPaths(FIXTURES_DIR, (relPath) => {
    const yamlPath = join(FIXTURES_DIR, relPath);
    const apiIrRel = openapiFixtureRelToApiirRel(relPath);
    const apiIrPath = join(FIXTURES_DIR, apiIrRel);

    if (!existsSync(apiIrPath)) {
      console.log(`[${apiIrRel}] SKIP - no ApiIR file`);
      return;
    }

    const content = readFileSync(yamlPath, 'utf-8');
    const parseResult = parseOpenAPI(content);
    if (!parseResult.success) {
      console.log(`[${relPath}] SKIP - parse failed`);
      return;
    }

    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) {
      console.log(`[${relPath}] SKIP - validate failed`);
      return;
    }

    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) {
      console.log(`[${relPath}] SKIP - resolve failed`);
      return;
    }

    const buildResult = buildApiIR(resolveResult.doc);
    if (!buildResult.success) {
      console.log(`[${relPath}] SKIP - build failed`);
      return;
    }

    const fromPipeline = apiIrStringify(buildResult.apiIr);
    const fromFile = apiIrStringify(JSON.parse(readFileSync(apiIrPath, 'utf-8')));

    if (fromPipeline === fromFile) {
      console.log(`[${apiIrRel}] ✓ MATCH`);
    } else {
      console.log(`[${apiIrRel}] ✗ MISMATCH`);
      console.log(`  Pipeline length: ${fromPipeline.length}`);
      console.log(`  File length:     ${fromFile.length}`);
      allMatch = false;
    }
  });

  process.exit(allMatch ? 0 : 1);
}

main();
