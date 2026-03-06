#!/usr/bin/env tsx
/**
 * Generate ApiIR JSON fixtures from OpenAPI YAML fixtures.
 * Reads from:
 *   - tests/compiler/fixtures/*.yaml (excludes invalid)
 *   - tests/compiler/fixtures/corpus-valid-v1/*.yaml
 * Writes to tests/compiler/fixtures/apiir/*.json and apiir/corpus-valid-v1/*.json
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
const CORPUS_DIR = join(FIXTURES_DIR, "corpus-valid-v1");
const INVALID_FIXTURE = "golden_openapi_invalid_expected_failure";

type Source = { inputDir: string; outputSubdir: string };

function processSource(source: Source): number {
  const { inputDir, outputSubdir } = source;
  const outputDir = outputSubdir ? join(APIIR_DIR, outputSubdir) : APIIR_DIR;

  if (!existsSync(inputDir)) {
    return 0;
  }

  const files = readdirSync(inputDir).filter(
    (f) =>
      (f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json")) &&
      !f.startsWith(INVALID_FIXTURE)
  );

  if (files.length === 0) {
    return 0;
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  let processed = 0;
  for (const file of files) {
    const baseName = file.replace(/\.(yaml|yml|json)$/i, "");
    const inputPath = join(inputDir, file);
    const outputPath = join(outputDir, `${baseName}.json`);

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
    processed++;
  }

  return processed;
}

function main() {
  if (!existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  if (!existsSync(APIIR_DIR)) {
    mkdirSync(APIIR_DIR, { recursive: true });
  }

  const sources: Source[] = [
    { inputDir: FIXTURES_DIR, outputSubdir: "" },
    { inputDir: CORPUS_DIR, outputSubdir: "corpus-valid-v1" },
  ];

  let total = 0;
  for (const source of sources) {
    const count = processSource(source);
    total += count;
  }

  if (total === 0) {
    console.log("No OpenAPI fixtures found (excluding invalid).");
    process.exit(0);
  }

  console.log(`Done. ${total} fixture(s) processed.`);
}

main();
