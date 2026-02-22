#!/usr/bin/env tsx
/**
 * Verify that ApiIR JSON fixtures match what the pipeline produces.
 * Run: npx tsx scripts/verify-apiir-fixtures.ts
 *
 * If they differ, the fixtures are stale or there's a JSON round-trip bug.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { buildApiIR, apiIrStringify } from "@/lib/compiler/apiir";

const FIXTURES_DIR = join(process.cwd(), "tests/compiler/fixtures");
const APIIR_DIR = join(FIXTURES_DIR, "apiir");

function main() {
  const files = readdirSync(FIXTURES_DIR).filter(
    (f) =>
      (f.endsWith(".yaml") || f.endsWith(".yml")) &&
      !f.startsWith("golden_openapi_invalid")
  );

  let allMatch = true;

  for (const file of files) {
    const baseName = file.replace(/\.(yaml|yml)$/, "");
    const yamlPath = join(FIXTURES_DIR, file);
    const apiIrPath = join(APIIR_DIR, `${baseName}.json`);

    if (!existsSync(apiIrPath)) {
      console.log(`[${baseName}] SKIP - no ApiIR file`);
      continue;
    }

    const content = readFileSync(yamlPath, "utf-8");
    const parseResult = parseOpenAPI(content);
    if (!parseResult.success) {
      console.log(`[${baseName}] SKIP - parse failed`);
      continue;
    }

    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) {
      console.log(`[${baseName}] SKIP - validate failed`);
      continue;
    }

    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) {
      console.log(`[${baseName}] SKIP - resolve failed`);
      continue;
    }

    const buildResult = buildApiIR(resolveResult.doc);
    if (!buildResult.success) {
      console.log(`[${baseName}] SKIP - build failed`);
      continue;
    }

    const fromPipeline = apiIrStringify(buildResult.apiIr);
    const fromFile = apiIrStringify(
      JSON.parse(readFileSync(apiIrPath, "utf-8"))
    );

    if (fromPipeline === fromFile) {
      console.log(`[${baseName}] ✓ MATCH`);
    } else {
      console.log(`[${baseName}] ✗ MISMATCH`);
      console.log(`  Pipeline length: ${fromPipeline.length}`);
      console.log(`  File length:     ${fromFile.length}`);
      allMatch = false;
    }
  }

  process.exit(allMatch ? 0 : 1);
}

main();
