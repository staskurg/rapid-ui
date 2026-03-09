#!/usr/bin/env tsx
/**
 * Standalone structural pattern mining on ApiIR fixtures.
 * Reads ApiIR JSON from tests/compiler/fixtures/apiir/valid-specs-{repo}/ (or path arg).
 * With --repo: auto-saves to scripts/corpus-data/reports/pattern-mining-{repo}-{timestamp}.md
 *
 * Usage: npm run corpus:pattern-mining -- --repo REPO [--output PATH]
 *   or:  npm run corpus:pattern-mining [path-to-apiir-dir]
 *   REPO: api-guru | github
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import type { ApiIR } from "@/lib/compiler/apiir";
import {
  mineStructuralPatterns,
  formatPatternMiningReport,
} from "./corpus-data/analyze-apiir";

const FIXTURES_APIIR = join(process.cwd(), "tests/compiler/fixtures/apiir");

function main(): number {
  const args = process.argv.slice(2);
  let dirArg: string | null = null;
  let outputPath: string | null = null;
  let repo: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--repo" && args[i + 1]) {
      repo = args[++i];
    } else if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      outputPath = args[++i];
    } else if (!args[i].startsWith("-")) {
      dirArg = args[i];
    }
  }

  let dir: string;
  if (dirArg) {
    dir = dirArg.startsWith("/") ? dirArg : join(process.cwd(), dirArg);
  } else if (repo === "api-guru" || repo === "github") {
    dir = join(FIXTURES_APIIR, `valid-specs-${repo}`);
  } else {
    dir = join(FIXTURES_APIIR, "valid-specs-api-guru"); // default
  }

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
  const reportContent = lines.join("\n");

  let savePath: string | null = outputPath;
  if (!savePath && (repo === "api-guru" || repo === "github")) {
    const reportsDir = join(process.cwd(), "scripts", "corpus-data", "reports");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    savePath = `scripts/corpus-data/reports/pattern-mining-${repo}-${timestamp}.md`;
  }

  if (savePath) {
    const absPath = join(process.cwd(), savePath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, reportContent, "utf-8");
    console.log(`Report written to: ${absPath}`);
  } else {
    console.log(reportContent);
  }

  return 0;
}

process.exit(main());
