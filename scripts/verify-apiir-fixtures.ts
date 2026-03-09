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

type Source = { yamlDir: string; apiirSubdir: string };

function main() {
  const sources: Source[] = [
    { yamlDir: join(FIXTURES_DIR, "demo"), apiirSubdir: "demo" },
    { yamlDir: join(FIXTURES_DIR, "valid-specs-api-guru"), apiirSubdir: "valid-specs-api-guru" },
  ];

  let allMatch = true;

  for (const { yamlDir, apiirSubdir } of sources) {
    if (!existsSync(yamlDir)) continue;

    const files = readdirSync(yamlDir).filter(
      (f) =>
        (f.endsWith(".yaml") || f.endsWith(".yml")) &&
        !f.startsWith("golden_openapi_invalid")
    );

    for (const file of files) {
      const baseName = file.replace(/\.(yaml|yml)$/, "");
      const yamlPath = join(yamlDir, file);
      const apiIrPath = join(APIIR_DIR, apiirSubdir, `${baseName}.json`);

      if (!existsSync(apiIrPath)) {
        console.log(`[${apiirSubdir}/${baseName}] SKIP - no ApiIR file`);
        continue;
      }

      const content = readFileSync(yamlPath, "utf-8");
      const parseResult = parseOpenAPI(content);
      if (!parseResult.success) {
        console.log(`[${apiirSubdir}/${baseName}] SKIP - parse failed`);
        continue;
      }

      const validateResult = validateSubset(parseResult.doc);
      if (!validateResult.success) {
        console.log(`[${apiirSubdir}/${baseName}] SKIP - validate failed`);
        continue;
      }

      const resolveResult = resolveRefs(parseResult.doc);
      if (!resolveResult.success) {
        console.log(`[${apiirSubdir}/${baseName}] SKIP - resolve failed`);
        continue;
      }

      const buildResult = buildApiIR(resolveResult.doc);
      if (!buildResult.success) {
        console.log(`[${apiirSubdir}/${baseName}] SKIP - build failed`);
        continue;
      }

      const fromPipeline = apiIrStringify(buildResult.apiIr);
      const fromFile = apiIrStringify(
        JSON.parse(readFileSync(apiIrPath, "utf-8"))
      );

      if (fromPipeline === fromFile) {
        console.log(`[${apiirSubdir}/${baseName}] ✓ MATCH`);
      } else {
        console.log(`[${apiirSubdir}/${baseName}] ✗ MISMATCH`);
        console.log(`  Pipeline length: ${fromPipeline.length}`);
        console.log(`  File length:     ${fromFile.length}`);
        allMatch = false;
      }
    }
  }

  process.exit(allMatch ? 0 : 1);
}

main();
