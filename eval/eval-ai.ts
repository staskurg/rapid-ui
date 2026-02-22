#!/usr/bin/env tsx
/**
 * Full pipeline evaluation: OpenAPI → UISpec determinism.
 * Loads OpenAPI from tests/compiler/fixtures/*.yaml (excludes invalid).
 * Runs compileOpenAPI N times sequentially per fixture.
 * Compares via UISpec fingerprint; overall = min per-resource similarity.
 * Requires OPENAI_API_KEY.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from "fs";
import { join } from "path";
import { compileOpenAPIForEval } from "./utils/compile-openapi";
import { validateSpecs } from "./utils/validator";
import {
  compareSpecsMulti,
  diffCanonical,
  canonicalString,
} from "./utils/comparator";

const DEFAULT_RUNS = 5;
const FIXTURES_DIR = join(process.cwd(), "tests/compiler/fixtures");
const REPORTS_DIR = join(process.cwd(), "eval/reports");
const FAILURES_DIR = join(process.cwd(), "eval/fixtures/failures");
const INVALID_FIXTURE = "golden_openapi_invalid_expected_failure";
const SIMILARITY_THRESHOLD = 0.9;
const VALIDITY_THRESHOLD = 0.9;

function requireOpenAIKey(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "OPENAI_API_KEY is required for evals. Add it to .env.local to run LLM determinism evaluation."
    );
  }
}

interface Config {
  runs: number;
  fixtureName?: string;
  quick?: boolean;
  json?: boolean;
  outputDir?: string;
  replayFailures?: boolean;
  parallel?: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    runs: DEFAULT_RUNS,
    quick: false,
    json: false,
    outputDir: REPORTS_DIR,
    replayFailures: false,
    parallel: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--quick" || arg === "-q") {
      config.quick = true;
      config.runs = 2;
    } else if (arg === "--runs" && args[i + 1]) {
      config.runs = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === "--fixture" && args[i + 1]) {
      config.fixtureName = args[i + 1];
      i++;
    } else if (arg === "--output-dir" && args[i + 1]) {
      config.outputDir = args[i + 1];
      i++;
    } else if (arg === "--replay-failures") {
      config.replayFailures = true;
    } else if (arg === "--json") {
      config.json = true;
    } else if (arg === "--parallel" || arg === "-p") {
      config.parallel = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Full pipeline evaluation (OpenAPI → UISpec determinism)

Usage: tsx eval/eval-ai.ts [options]

Options:
  --runs N           Number of runs per fixture (default: ${DEFAULT_RUNS})
  --quick, -q        Quick mode: 2 runs
  --fixture NAME     Run specific fixture only
  --output-dir DIR   Report output directory
  --replay-failures  Replay saved failures from eval/fixtures/failures/
  --parallel, -p     Run all runs in parallel (faster; may hit rate limits)
  --json             Output JSON for CI
  --help, -h         Show this help
      `);
      process.exit(0);
    }
  }

  return config;
}

interface FailureData {
  fixtureName: string;
  runNumber: number;
  openapiPath: string;
  timestamp: string;
  errors: string[];
  rawResponse?: string;
}

function getFixtures(config: Config): string[] {
  if (config.replayFailures && existsSync(FAILURES_DIR)) {
    const files = readdirSync(FAILURES_DIR).filter((f) => f.endsWith(".json"));
    const fixturePaths = new Set<string>();
    for (const f of files) {
      try {
        const data = JSON.parse(
          readFileSync(join(FAILURES_DIR, f), "utf-8")
        ) as FailureData;
        if (data.openapiPath && existsSync(data.openapiPath)) {
          fixturePaths.add(data.openapiPath);
        } else if (data.fixtureName) {
          const yaml = join(FIXTURES_DIR, `${data.fixtureName}.yaml`);
          const yml = join(FIXTURES_DIR, `${data.fixtureName}.yml`);
          if (existsSync(yaml)) fixturePaths.add(yaml);
          else if (existsSync(yml)) fixturePaths.add(yml);
        }
      } catch {
        // skip
      }
    }
    return [...fixturePaths];
  }

  if (config.fixtureName) {
    const yaml = join(FIXTURES_DIR, `${config.fixtureName}.yaml`);
    const yml = join(FIXTURES_DIR, `${config.fixtureName}.yml`);
    if (existsSync(yaml)) return [yaml];
    if (existsSync(yml)) return [yml];
    throw new Error(`Fixture not found: ${config.fixtureName}`);
  }

  return readdirSync(FIXTURES_DIR)
    .filter(
      (f) =>
        (f.endsWith(".yaml") || f.endsWith(".yml")) &&
        !f.startsWith(INVALID_FIXTURE)
    )
    .map((f) => join(FIXTURES_DIR, f));
}

interface RunResult {
  runNumber: number;
  specs: Record<string, import("@/lib/spec/types").UISpec> | null;
  valid: boolean;
  errors: string[];
}

interface FixtureResult {
  fixtureName: string;
  fixturePath: string;
  runs: RunResult[];
  validRuns: number;
  invalidRuns: number;
  minSimilarity: number;
  passed: boolean;
  errors: string[];
}

async function runSingleEval(
  fixtureName: string,
  fixturePath: string,
  openapiString: string,
  runNumber: number
): Promise<RunResult> {
  try {
    const result = await compileOpenAPIForEval(openapiString);

    if (result.success) {
      const validation = validateSpecs(result.specs);
      if (validation.isValid) {
        return {
          runNumber,
          specs: result.specs,
          valid: true,
          errors: [],
        };
      }
      saveFailure(fixtureName, fixturePath, runNumber, validation.errors);
      return {
        runNumber,
        specs: null,
        valid: false,
        errors: validation.errors,
      };
    }
    const errMsgs = result.errors.map((e) => e.message);
    saveFailure(fixtureName, fixturePath, runNumber, errMsgs);
    return {
      runNumber,
      specs: null,
      valid: false,
      errors: errMsgs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    saveFailure(fixtureName, fixturePath, runNumber, [msg]);
    return {
      runNumber,
      specs: null,
      valid: false,
      errors: [msg],
    };
  }
}

async function evaluateFixture(
  fixturePath: string,
  runs: number,
  parallel: boolean
): Promise<FixtureResult> {
  const fixtureName = fixturePath.split("/").pop()?.replace(/\.(yaml|yml)$/, "") ?? "unknown";
  const openapiString = readFileSync(fixturePath, "utf-8");

  let runResults: RunResult[];

  if (parallel) {
    process.stdout.write(`  Running ${runs} runs in parallel... `);
    runResults = await Promise.all(
      Array.from({ length: runs }, (_, i) =>
        runSingleEval(fixtureName, fixturePath, openapiString, i + 1)
      )
    );
    runResults.sort((a, b) => a.runNumber - b.runNumber);
    const statuses = runResults.map((r) => (r.valid ? "✓" : `✗`));
    console.log(statuses.join(" "));
  } else {
    runResults = [];
    for (let i = 0; i < runs; i++) {
      const runNumber = i + 1;
      process.stdout.write(`  Run ${runNumber}/${runs}... `);
      const r = await runSingleEval(
        fixtureName,
        fixturePath,
        openapiString,
        runNumber
      );
      runResults.push(r);
      console.log(r.valid ? "✓" : `✗ ${r.errors[0] ?? "?"}`);
    }
  }

  const validRuns = runResults.filter((r) => r.valid);
  const invalidRuns = runs - validRuns.length;

  let minSimilarity = 1;
  const errors = [...new Set(runResults.flatMap((r) => r.errors))];

  if (validRuns.length >= 2) {
    let minAcrossPairs = 1;
    let worstPair: { i: number; j: number; comp: ReturnType<typeof compareSpecsMulti> } | null = null;
    for (let i = 0; i < validRuns.length; i++) {
      for (let j = i + 1; j < validRuns.length; j++) {
        const comp = compareSpecsMulti(validRuns[i].specs!, validRuns[j].specs!);
        if (!comp.sameSlugs) {
          errors.push(comp.slugMismatch ?? "Slug mismatch");
          minAcrossPairs = 0;
        } else {
          if (comp.minSimilarity < minAcrossPairs) {
            minAcrossPairs = comp.minSimilarity;
            worstPair = { i, j, comp };
          }
        }
      }
    }
    minSimilarity = minAcrossPairs;
    // Diff on failure for prompt debugging
    if (minAcrossPairs < SIMILARITY_THRESHOLD && worstPair) {
      const { i, j, comp } = worstPair;
      const a = canonicalString(validRuns[i].specs!);
      const b = canonicalString(validRuns[j].specs!);
      console.log(`\n  Diff (runs ${i + 1} vs ${j + 1}, similarity ${(comp.minSimilarity * 100).toFixed(1)}%):`);
      console.log(diffCanonical(a, b).split("\n").slice(0, 20).join("\n"));
    }
  }

  const validityRate = validRuns.length / runs;
  const passed =
    validityRate >= VALIDITY_THRESHOLD &&
    minSimilarity >= SIMILARITY_THRESHOLD;

  return {
    fixtureName,
    fixturePath,
    runs: runResults,
    validRuns: validRuns.length,
    invalidRuns,
    minSimilarity,
    passed,
    errors,
  };
}

function saveFailure(
  fixtureName: string,
  openapiPath: string,
  runNumber: number,
  errors: string[]
): void {
  if (!existsSync(FAILURES_DIR)) {
    mkdirSync(FAILURES_DIR, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(FAILURES_DIR, `${fixtureName}-run${runNumber}-${ts}.json`);
  const data: FailureData = {
    fixtureName,
    runNumber,
    openapiPath,
    timestamp: new Date().toISOString(),
    errors,
  };
  writeFileSync(file, JSON.stringify(data, null, 2));
}

async function main() {
  requireOpenAIKey();
  const config = parseArgs();

  const fixtures = getFixtures(config);
  if (fixtures.length === 0) {
    console.error("No fixtures found.");
    process.exit(1);
  }

  console.log("Full Pipeline Evaluation (OpenAPI → UISpec)");
  console.log("=".repeat(50));
  console.log(`Runs per fixture: ${config.runs}${config.quick ? " (quick)" : ""}${config.parallel ? " (parallel)" : ""}`);
  console.log(`Fixtures: ${fixtures.length}`);
  console.log("");

  const results: FixtureResult[] = [];

  if (config.parallel) {
    const fixtureResults = await Promise.all(
      fixtures.map(async (path) => {
        const name = path.split("/").pop() ?? "?";
        console.log(`\nFixture: ${name}`);
        const result = await evaluateFixture(path, config.runs, true);
        console.log(
          `  Valid: ${result.validRuns}/${config.runs}, Min similarity: ${(result.minSimilarity * 100).toFixed(1)}%`
        );
        return result;
      })
    );
    results.push(...fixtureResults);
  } else {
    for (const path of fixtures) {
      const name = path.split("/").pop() ?? "?";
      console.log(`\nFixture: ${name}`);
      const result = await evaluateFixture(path, config.runs, false);
      results.push(result);
      console.log(
        `  Valid: ${result.validRuns}/${config.runs}, Min similarity: ${(result.minSimilarity * 100).toFixed(1)}%`
      );
    }
  }

  const totalRuns = results.reduce((s, r) => s + r.runs.length, 0);
  const totalValid = results.reduce((s, r) => s + r.validRuns, 0);
  const validityRate = totalRuns > 0 ? totalValid / totalRuns : 0;
  const minSimAcross =
    results.filter((r) => r.validRuns > 0).length > 0
      ? Math.min(...results.filter((r) => r.validRuns > 0).map((r) => r.minSimilarity))
      : 1;
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
  console.log(`Min similarity: ${(minSimAcross * 100).toFixed(1)}%`);
  console.log(allPassed ? "\n✅ Passed" : "\n⚠️ Failed");

  if (config.outputDir) {
    mkdirSync(config.outputDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = join(config.outputDir, `report-full-${ts}.txt`);
    const lines = [
      `Full Pipeline Eval Report - ${new Date().toISOString()}`,
      `Validity: ${(validityRate * 100).toFixed(1)}%`,
      `Min similarity: ${(minSimAcross * 100).toFixed(1)}%`,
      "",
      ...results.map(
        (r) =>
          `${r.fixtureName}: valid ${r.validRuns}/${r.runs.length}, sim ${(r.minSimilarity * 100).toFixed(1)}%`
      ),
    ];
    writeFileSync(reportPath, lines.join("\n"));
    console.log(`\nReport: ${reportPath}`);
  }

  if (config.json) {
    console.log(
      JSON.stringify({
        passed: allPassed,
        validity: validityRate,
        similarity: minSimAcross,
        errors: results.flatMap((r) => r.errors),
      })
    );
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
