#!/usr/bin/env tsx
/**
 * Standalone structural pattern mining on ApiIR fixtures.
 * Reads ApiIR JSON from tests/compiler/fixtures/apiir/corpus-valid-v1/ (or path arg).
 * Prints pattern distribution report to stdout.
 *
 * Usage: npm run corpus:pattern-mining [path-to-apiir-dir]
 * Example: npm run corpus:pattern-mining
 *          npm run corpus:pattern-mining tests/compiler/fixtures/apiir/corpus-valid-v1
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { ApiIR } from "@/lib/compiler/apiir";
import {
  mineStructuralPatterns,
  formatPatternMiningReport,
} from "./corpus-data/analyze-apiir";

const DEFAULT_DIR = join(
  process.cwd(),
  "tests/compiler/fixtures/apiir/corpus-valid-v1"
);

function main(): number {
  const dirArg = process.argv[2];
  const dir = dirArg ? join(process.cwd(), dirArg) : DEFAULT_DIR;

  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return 1;
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const entries: Array<{ apiIr: ApiIR; specPath: string }> = [];

  for (const file of files) {
    const filePath = join(dir, file);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      console.error(`Failed to read ${file}: ${err}`);
      continue;
    }

    let apiIr: ApiIR;
    try {
      apiIr = JSON.parse(content) as ApiIR;
    } catch (err) {
      console.error(`Failed to parse ${file}: ${err}`);
      continue;
    }

    entries.push({ apiIr, specPath: filePath });
  }

  if (entries.length === 0) {
    console.error(`No ApiIR JSON files found in ${dir}`);
    return 1;
  }

  const { results, totalResources } = mineStructuralPatterns(entries);
  const lines = formatPatternMiningReport(results, totalResources);
  console.log(lines.join("\n"));

  return 0;
}

process.exit(main());
