#!/usr/bin/env tsx
/**
 * AI Evaluation Harness
 * 
 * Runs AI generation multiple times per fixture to measure:
 * - Structural validity (schema compliance)
 * - Logical integrity (field references, enum options)
 * - Stability/determinism (structural consistency across runs)
 * - Edge tolerance (handling weird/incomplete payloads)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateSpecWithAI } from "./utils/ai-generator.js";
import { validateSpec } from "./utils/validator.js";
import {
  extractFingerprint,
  compareMultipleFingerprints,
} from "./utils/comparator.js";
import {
  generateMarkdownReport,
  generateTextReport,
  type RunResult,
  type FixtureResult,
  type EvaluationReport,
} from "./utils/reporter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default configuration
const DEFAULT_RUNS = 5;
const DEFAULT_FIXTURES_DIR = join(__dirname, "fixtures"); // Use eval/fixtures for payloads
const DEFAULT_REPORTS_DIR = join(__dirname, "reports");
const DEFAULT_FAILURES_DIR = join(__dirname, "fixtures/failures");

interface Config {
  runs: number;
  fixturesDir: string;
  reportsDir: string;
  failuresDir: string;
  fixtureName?: string; // If specified, only run this fixture
  replayFailures?: boolean; // If true, replay saved failures
}

/**
 * Parse command-line arguments
 */
function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    runs: DEFAULT_RUNS,
    fixturesDir: DEFAULT_FIXTURES_DIR,
    reportsDir: DEFAULT_REPORTS_DIR,
    failuresDir: DEFAULT_FAILURES_DIR,
    replayFailures: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--runs" && i + 1 < args.length) {
      config.runs = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === "--fixture" && i + 1 < args.length) {
      config.fixtureName = args[i + 1];
      i++;
    } else if (arg === "--output-dir" && i + 1 < args.length) {
      config.reportsDir = args[i + 1];
      i++;
    } else if (arg === "--replay-failures") {
      config.replayFailures = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
AI Evaluation Harness

Usage: tsx eval/eval-ai.ts [options]

Options:
  --runs N           Number of runs per fixture (default: ${DEFAULT_RUNS})
  --fixture NAME     Run specific fixture only
  --output-dir DIR   Custom report output directory (default: eval/reports)
  --replay-failures  Replay saved failures from eval/fixtures/failures/
  --help, -h         Show this help message
      `);
      process.exit(0);
    }
  }

  return config;
}

/**
 * Load fixture payload
 */
function loadFixture(fixturePath: string): unknown {
  try {
    const content = readFileSync(fixturePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load fixture ${fixturePath}: ${error}`);
  }
}

/**
 * Load failure data from saved failures
 */
interface FailureData {
  fixtureName: string;
  runNumber: number;
  timestamp: string;
  errors: string[];
  rawResponse: string;
}

function loadFailures(failuresDir: string): FailureData[] {
  if (!existsSync(failuresDir)) {
    return [];
  }

  const files = readdirSync(failuresDir);
  const failures: FailureData[] = [];

  files
    .filter((f) => f.endsWith(".json"))
    .forEach((f) => {
      try {
        const failurePath = join(failuresDir, f);
        const content = readFileSync(failurePath, "utf-8");
        const failureData = JSON.parse(content) as FailureData;
        failures.push(failureData);
      } catch (error) {
        console.warn(`Failed to load failure file ${f}: ${error}`);
      }
    });

  return failures;
}

/**
 * Get list of fixture files
 */
function getFixtures(config: Config): string[] {
  const fixtures: string[] = [];

  if (config.replayFailures) {
    // Load failures and extract original fixture names
    const failures = loadFailures(config.failuresDir);
    const fixtureNames = new Set(failures.map((f) => f.fixtureName));
    
    if (fixtureNames.size === 0) {
      console.warn("No failures found to replay. Running normal evaluation instead.");
      return getFixtures({ ...config, replayFailures: false });
    }

    // Load fixtures that had failures
    fixtureNames.forEach((name) => {
      const fixturePath = join(config.fixturesDir, `${name}.json`);
      if (existsSync(fixturePath)) {
        fixtures.push(fixturePath);
      } else {
        console.warn(`Fixture ${name} not found, skipping failure replay for it`);
      }
    });

    console.log(`\nReplaying failures for ${fixtures.length} fixture(s)`);
    return fixtures;
  }

  if (config.fixtureName) {
    // Single fixture specified
    const fixturePath = join(config.fixturesDir, `${config.fixtureName}.json`);
    if (existsSync(fixturePath)) {
      fixtures.push(fixturePath);
    } else {
      throw new Error(`Fixture not found: ${config.fixtureName}`);
    }
  } else {
    // Load all fixtures from directory
    const files = readdirSync(config.fixturesDir);
    files
      .filter((f) => f.endsWith(".json"))
      .forEach((f) => {
        fixtures.push(join(config.fixturesDir, f));
      });
  }

  return fixtures;
}

/**
 * Evaluate a single fixture
 */
async function evaluateFixture(
  fixturePath: string,
  runs: number
): Promise<FixtureResult> {
  const fixtureName = fixturePath.split("/").pop()?.replace(".json", "") || "unknown";
  console.log(`\nEvaluating fixture: ${fixtureName} (${runs} runs)`);

  const payload = loadFixture(fixturePath);
  const runResults: RunResult[] = [];

  // Run AI generation N times
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`  Run ${i + 1}/${runs}... `);

    try {
      const { spec, rawResponse, source } = await generateSpecWithAI(payload);
      const validation = validateSpec(spec);

      let fingerprint = null;
      if (validation.isValid) {
        fingerprint = extractFingerprint(spec);
      }

      const runResult: RunResult = {
        runNumber: i + 1,
        spec: validation.isValid ? spec : null,
        rawResponse,
        source,
        validationResult: validation.schemaResult,
        logicalResult: validation.logicalResult,
        fingerprint,
        error: validation.errors.length > 0 ? validation.errors.join("; ") : undefined,
      };

      runResults.push(runResult);

      if (!validation.isValid) {
        saveFailure(fixtureName, i + 1, rawResponse, validation.errors);
      }

      process.stdout.write(
        validation.isValid ? "✓\n" : `✗ (${validation.errors[0]})\n`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      process.stdout.write(`✗ (${errorMessage})\n`);

      runResults.push({
        runNumber: i + 1,
        spec: null,
        rawResponse: errorMessage,
        source: "fallback",
        validationResult: {
          isValid: false,
          errors: [errorMessage],
          warnings: [],
        },
        logicalResult: null,
        fingerprint: null,
        error: errorMessage,
      });

      saveFailure(fixtureName, i + 1, errorMessage, [errorMessage]);
    }

    // Small delay between runs to avoid rate limiting
    if (i < runs - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Analyze results
  const validRuns = runResults.filter((r) => r.validationResult.isValid).length;
  const invalidRuns = runs - validRuns;
  const fallbackRuns = runResults.filter((r) => r.source === "fallback").length;

  // Collect all errors and warnings
  const errors = new Set<string>();
  const warnings = new Set<string>();
  runResults.forEach((r) => {
    r.validationResult.errors.forEach((e) => errors.add(e));
    r.validationResult.warnings.forEach((w) => warnings.add(w));
    if (r.error) {
      errors.add(r.error);
    }
  });

  // Calculate stability metrics
  const validFingerprints = runResults
    .filter((r) => r.fingerprint !== null)
    .map((r) => r.fingerprint!);

  let averageSimilarity = 1.0;
  let minSimilarity = 1.0;
  let maxSimilarity = 1.0;
  let consistent = true;

  if (validFingerprints.length > 1) {
    const comparison = compareMultipleFingerprints(validFingerprints);
    averageSimilarity = comparison.averageSimilarity;
    minSimilarity = comparison.minSimilarity;
    maxSimilarity = comparison.maxSimilarity;
    consistent = comparison.consistent;
  }

  return {
    fixtureName,
    runs: runResults,
    totalRuns: runs,
    validRuns,
    invalidRuns,
    fallbackRuns,
    averageSimilarity,
    minSimilarity,
    maxSimilarity,
    consistent,
    errors: [...errors],
    warnings: [...warnings],
  };
}

/**
 * Save failure response for replay
 */
function saveFailure(
  fixtureName: string,
  runNumber: number,
  rawResponse: string,
  errors: string[]
): void {
  const failuresDir = DEFAULT_FAILURES_DIR;
  if (!existsSync(failuresDir)) {
    mkdirSync(failuresDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const failureFile = join(
    failuresDir,
    `${fixtureName}-run${runNumber}-${timestamp}.json`
  );

  const failureData = {
    fixtureName,
    runNumber,
    timestamp: new Date().toISOString(),
    errors,
    rawResponse,
  };

  writeFileSync(failureFile, JSON.stringify(failureData, null, 2));
  console.log(`    Saved failure to: ${failureFile}`);
}

/**
 * Generate and save report
 */
function saveReport(report: EvaluationReport, config: Config): void {
  if (!existsSync(config.reportsDir)) {
    mkdirSync(config.reportsDir, { recursive: true });
  }

  const timestamp = report.timestamp.replace(/[:.]/g, "-");
  const markdownPath = join(config.reportsDir, `report-${timestamp}.md`);
  const textPath = join(config.reportsDir, `report-${timestamp}.txt`);

  writeFileSync(markdownPath, generateMarkdownReport(report));
  writeFileSync(textPath, generateTextReport(report));

  console.log(`\nReports saved:`);
  console.log(`  Markdown: ${markdownPath}`);
  console.log(`  Text: ${textPath}`);
}

/**
 * Main evaluation function
 */
async function main() {
  const config = parseArgs();

  console.log("AI Evaluation Harness");
  console.log("=".repeat(50));
  console.log(`Runs per fixture: ${config.runs}`);
  console.log(`Fixtures directory: ${config.fixturesDir}`);
  console.log(`Reports directory: ${config.reportsDir}`);
  if (config.replayFailures) {
    console.log(`Mode: Replaying failures from ${config.failuresDir}`);
  }

  // Get fixtures
  const fixtures = getFixtures(config);
  if (fixtures.length === 0) {
    console.error("No fixtures found!");
    process.exit(1);
  }

  console.log(`\nFound ${fixtures.length} fixture(s)`);

  // Evaluate each fixture
  const fixtureResults: FixtureResult[] = [];
  let totalRuns = 0;
  let totalValidRuns = 0;

  for (const fixturePath of fixtures) {
    const result = await evaluateFixture(fixturePath, config.runs);
    fixtureResults.push(result);
    totalRuns += result.totalRuns;
    totalValidRuns += result.validRuns;
  }

  // Calculate overall metrics
  const overallValidRate = totalRuns > 0 ? totalValidRuns / totalRuns : 0;
  
  // Calculate overall stability as average of per-fixture stability scores
  // (not by comparing across fixtures, which would be meaningless)
  const fixtureStabilities = fixtureResults
    .filter((fr) => fr.validRuns > 0) // Only include fixtures with valid runs
    .map((fr) => fr.averageSimilarity);
  
  const overallStability =
    fixtureStabilities.length > 0
      ? fixtureStabilities.reduce((a, b) => a + b, 0) / fixtureStabilities.length
      : 1.0;

  // Generate report
  const report: EvaluationReport = {
    timestamp: new Date().toISOString(),
    totalFixtures: fixtureResults.length,
    totalRuns,
    overallValidRate,
    overallStability,
    fixtureResults,
  };

  // Save reports
  saveReport(report, config);

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("Evaluation Summary");
  console.log("=".repeat(50));
  console.log(`Total Fixtures: ${report.totalFixtures}`);
  console.log(`Total Runs: ${report.totalRuns}`);
  console.log(
    `Overall Valid Rate: ${(report.overallValidRate * 100).toFixed(1)}%`
  );
  console.log(
    `Overall Stability: ${(report.overallStability * 100).toFixed(1)}%`
  );

  if (report.overallValidRate >= 0.9) {
    console.log("\n✅ Valid rate meets target (≥90%)");
  } else {
    console.log("\n⚠️  Valid rate below target (<90%)");
  }

  if (report.overallStability >= 0.9) {
    console.log("✅ Stability is high");
  } else {
    console.log("⚠️  Stability is low");
  }
}

// Run main function
main().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
