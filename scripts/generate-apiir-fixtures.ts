#!/usr/bin/env tsx
/**
 * Generate ApiIR JSON fixtures from OpenAPI YAML fixtures.
 * Reads from tests/compiler/fixtures/*.yaml (excludes invalid).
 * Writes to tests/compiler/fixtures/apiir/*.json
 *
 * Run after parse/validate/build changes. Commit updated ApiIR files.
 *
 * Usage: npm run fixtures:generate-apiir
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { buildApiIR } from "@/lib/compiler/apiir";

const FIXTURES_DIR = join(process.cwd(), "tests/compiler/fixtures");
const APIIR_DIR = join(FIXTURES_DIR, "apiir");
const INVALID_FIXTURE = "golden_openapi_invalid_expected_failure";

function main() {
  if (!existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(FIXTURES_DIR).filter(
    (f) =>
      (f.endsWith(".yaml") || f.endsWith(".yml")) &&
      !f.startsWith(INVALID_FIXTURE)
  );

  if (files.length === 0) {
    console.log("No OpenAPI fixtures found (excluding invalid).");
    process.exit(0);
  }

  if (!existsSync(APIIR_DIR)) {
    mkdirSync(APIIR_DIR, { recursive: true });
  }

  for (const file of files) {
    const baseName = file.replace(/\.(yaml|yml)$/, "");
    const inputPath = join(FIXTURES_DIR, file);
    const outputPath = join(APIIR_DIR, `${baseName}.json`);

    const content = readFileSync(inputPath, "utf-8");
    const parseResult = parseOpenAPI(content);

    if (!parseResult.success) {
      console.error(`[${file}] Parse failed: ${parseResult.error.message}`);
      continue;
    }

    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) {
      console.error(`[${file}] Validation failed: ${validateResult.errors.map((e) => e.message).join("; ")}`);
      continue;
    }

    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) {
      console.error(`[${file}] Resolve failed: ${resolveResult.error.message}`);
      continue;
    }

    const buildResult = buildApiIR(resolveResult.doc);
    if (!buildResult.success) {
      console.error(`[${file}] Build failed: ${buildResult.error.message}`);
      continue;
    }

    writeFileSync(
      outputPath,
      JSON.stringify(buildResult.apiIr, null, 2)
    );
    console.log(`Generated: ${outputPath}`);
  }

  console.log(`Done. ${files.length} fixture(s) processed.`);
}

main();
