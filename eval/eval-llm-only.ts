#!/usr/bin/env tsx
/**
 * LLM-only evaluation: ApiIR → UiPlanIR determinism.
 * Loads ApiIR from tests/compiler/fixtures/apiir/*.json.
 * Runs llmPlan N times per fixture, compares via UiPlanIR fingerprint.
 * Requires OPENAI_API_KEY.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const REPORTS_DIR = join(process.cwd(), "eval/reports");
import {
  getApiIRFixtures,
  evaluateLlmOnlyFixture,
  type LlmOnlyFixtureResult,
} from "./utils/llm-only-eval";
import { buildLlmOnlyReport } from "./utils/report-schema";

const DEFAULT_RUNS = 5;
const FIXTURES_APIIR_DIR = join(process.cwd(), "tests/compiler/fixtures/apiir");

function requireOpenAIKey(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "OPENAI_API_KEY is required for evals. Add it to .env.local to run LLM determinism evaluation."
    );
  }
}

function parseArgs(): {
  runs: number;
  fixtureName?: string;
  quick?: boolean;
  json?: boolean;
  parallel?: boolean;
  outputDir?: string;
} {
  const args = process.argv.slice(2);
  let runs = DEFAULT_RUNS;
  let fixtureName: string | undefined;
  let quick = false;
  let json = false;
  let parallel = false;
  let outputDir = REPORTS_DIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--quick" || args[i] === "-q") {
      quick = true;
      runs = 5; // plan: 5 runs for llm-only in quick
    } else if (args[i] === "--runs" && args[i + 1]) {
      runs = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--fixture" && args[i + 1]) {
      fixtureName = args[i + 1];
      i++;
    } else if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === "--json") {
      json = true;
    } else if (args[i] === "--parallel" || args[i] === "-p") {
      parallel = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
LLM-only evaluation (ApiIR → UiPlanIR determinism)

Usage: tsx eval/eval-llm-only.ts [options]

Options:
  --runs N         Number of runs per fixture (default: ${DEFAULT_RUNS})
  --quick, -q      Quick mode: 5 runs
  --fixture NAME   Run specific fixture only (base name without .json)
  --output-dir DIR Report output directory (default: eval/reports)
  --parallel, -p   Run all runs in parallel (faster; may hit rate limits)
  --json           Output JSON for CI
  --help, -h       Show this help
      `);
      process.exit(0);
    }
  }

  return { runs, fixtureName, quick, json, parallel, outputDir };
}

async function main() {
  requireOpenAIKey();
  const config = parseArgs();

  let fixtures = getApiIRFixtures(FIXTURES_APIIR_DIR);
  if (config.fixtureName) {
    const path = join(FIXTURES_APIIR_DIR, `${config.fixtureName}.json`);
    if (fixtures.includes(path)) {
      fixtures = [path];
    } else {
      console.error(`Fixture not found: ${config.fixtureName}`);
      process.exit(1);
    }
  }

  if (fixtures.length === 0) {
    console.error(
      "No ApiIR fixtures found. Run: npm run fixtures:generate-apiir"
    );
    process.exit(1);
  }

  console.log("LLM-only Evaluation (ApiIR → UiPlanIR)");
  console.log("=".repeat(50));
  console.log(`Runs per fixture: ${config.runs}${config.parallel ? " (parallel)" : ""}`);
  console.log(`Fixtures: ${fixtures.length}`);
  console.log("");

  const results: LlmOnlyFixtureResult[] = [];

  if (config.parallel) {
    // Parallel runs per fixture only (not fixtures) — avoids rate limits
    for (const fixturePath of fixtures) {
      const name = fixturePath.split("/").pop()?.replace(".json", "") ?? "?";
      console.log(`\nEvaluating: ${name} (${config.runs} runs in parallel)`);
      const result = await evaluateLlmOnlyFixture(
        fixturePath,
        config.runs,
        true
      );
      results.push(result);
      const statuses = result.runs.map((r) =>
        r.uiPlan ? "✓" : `✗ (${r.error ?? "?"})`
      );
      console.log(`  ${statuses.join(" ")}`);
      console.log(
        `  Valid: ${result.validRuns}/${result.totalRuns}, Similarity: ${(result.minSimilarity * 100).toFixed(1)}% (min)`
      );
    }
  } else {
    for (const fixturePath of fixtures) {
      const name = fixturePath.split("/").pop()?.replace(".json", "") ?? "?";
      console.log(`\nEvaluating: ${name} (${config.runs} runs)`);
      const result = await evaluateLlmOnlyFixture(
        fixturePath,
        config.runs,
        false
      );
      results.push(result);

      const statuses = result.runs.map((r) =>
        r.uiPlan ? "✓" : `✗ (${r.error ?? "?"})`
      );
      console.log(`  ${statuses.join(" ")}`);
      console.log(
        `  Valid: ${result.validRuns}/${result.totalRuns}, Similarity: ${(result.minSimilarity * 100).toFixed(1)}% (min)`
      );
    }
  }

  const totalRuns = results.reduce((s, r) => s + r.totalRuns, 0);
  const totalValid = results.reduce((s, r) => s + r.validRuns, 0);
  const validityRate = totalRuns > 0 ? totalValid / totalRuns : 0;
  const minSimAcross = Math.min(
    ...results.filter((r) => r.validRuns > 0).map((r) => r.minSimilarity),
    1
  );
  const allPassed = results.every((r) => r.passed);
  const noValidRuns = totalValid === 0;

  if (noValidRuns) {
    console.error("\nNo valid runs. Eval failed.");
    if (config.json) {
      console.log(
        JSON.stringify({
          passed: false,
          validity: 0,
          similarity: 0,
          errors: results.flatMap((r) => r.errors),
        })
      );
    }
    process.exit(1);
  }

  console.log("\n" + "=".repeat(50));
  console.log("Summary");
  console.log("=".repeat(50));
  console.log(`Validity: ${(validityRate * 100).toFixed(1)}%`);
  console.log(`Min similarity (across fixtures): ${(minSimAcross * 100).toFixed(1)}%`);
  console.log(allPassed ? "\n✅ Passed" : "\n⚠️ Failed");

  if (!allPassed) {
    const failedWithDiffs = results.filter(
      (r) => !r.passed && r.similarityDifferences && r.similarityDifferences.length > 0
    );
    for (const r of failedWithDiffs) {
      console.log(`\n  Diff [${r.fixtureName}] (similarity ${(r.minSimilarity * 100).toFixed(1)}%):`);
      r.similarityDifferences!.forEach((d) => console.log(`    ${d}`));
    }
  }

  if (config.outputDir) {
    mkdirSync(config.outputDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonReport = buildLlmOnlyReport(
      { runs: config.runs, parallel: config.parallel ?? false },
      results,
      totalRuns,
      totalValid,
      validityRate,
      minSimAcross,
      allPassed
    );
    const jsonPath = join(config.outputDir, `report-llm-only-${ts}.json`);
    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    const txtPath = join(config.outputDir, `report-llm-only-${ts}.txt`);
    const lines = [
      `LLM-only Eval Report - ${new Date().toISOString()}`,
      `Validity: ${(validityRate * 100).toFixed(1)}%`,
      `Min similarity (across fixtures): ${(minSimAcross * 100).toFixed(1)}%`,
      "",
      ...results.map(
        (r) =>
          `${r.fixtureName}: valid ${r.validRuns}/${r.totalRuns}, sim ${(r.minSimilarity * 100).toFixed(1)}%`
      ),
    ];
    writeFileSync(txtPath, lines.join("\n"));
    console.log(`\nReports: ${jsonPath}, ${txtPath}`);
  }

  if (config.json) {
    console.log(
      JSON.stringify({
        passed: allPassed,
        validity: validityRate,
        similarity: minSimAcross,
        errors: results.flatMap((r) => r.errors),
        similarityDifferences: results
          .filter((r) => r.similarityDifferences?.length)
          .flatMap((r) =>
            r.similarityDifferences!.map((d) => `[${r.fixtureName}] ${d}`)
          ),
      })
    );
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
