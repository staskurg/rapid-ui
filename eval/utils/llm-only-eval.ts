/**
 * LLM-only eval: ApiIR → UiPlanIR.
 * Loads ApiIR from pre-computed fixture files (tests/compiler/fixtures/apiir/*.json).
 * No pipeline code runs — true LLM isolation.
 * Runs llmPlan N times, compares via UiPlanIR fingerprint similarity.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { llmPlan } from "@/lib/compiler/uiplan/llm-plan";
import { normalizeUiPlanIR } from "@/lib/compiler/uiplan/normalize";
import type { ApiIR } from "@/lib/compiler/apiir";
import {
  extractUiPlanIRFingerprint,
  compareUiPlanIRFingerprints,
} from "./comparator";

const SIMILARITY_THRESHOLD = 0.9;

export interface LlmOnlyRunResult {
  runNumber: number;
  uiPlan: import("@/lib/compiler/uiplan/uiplan.schema").UiPlanIR | null;
  fingerprint: ReturnType<typeof extractUiPlanIRFingerprint> | null;
  error?: string;
}

export interface LlmOnlyFixtureResult {
  fixtureName: string;
  apiIrPath: string;
  runs: LlmOnlyRunResult[];
  totalRuns: number;
  validRuns: number;
  invalidRuns: number;
  averageSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  passed: boolean;
  errors: string[];
  /** Structural differences from worst pair when similarity < threshold (for prompt debugging). */
  similarityDifferences?: string[];
}

/**
 * Load ApiIR from JSON file.
 */
export function loadApiIRFromFile(path: string): ApiIR {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as ApiIR;
}

async function runSingleLlmPlan(
  apiIr: ApiIR,
  runNumber: number
): Promise<LlmOnlyRunResult> {
  try {
    const llmResult = await llmPlan(apiIr, { source: "eval" });

    if (!llmResult.success) {
      return {
        runNumber,
        uiPlan: null,
        fingerprint: null,
        error: llmResult.error.message,
      };
    }

    const normalized = normalizeUiPlanIR(llmResult.uiPlan);
    const fingerprint = extractUiPlanIRFingerprint(normalized);

    return {
      runNumber,
      uiPlan: normalized,
      fingerprint,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      runNumber,
      uiPlan: null,
      fingerprint: null,
      error: msg,
    };
  }
}

/**
 * Run llmPlan N times on the same ApiIR, return results.
 */
export async function runLlmOnlyEval(
  apiIr: ApiIR,
  runs: number,
  parallel = false
): Promise<LlmOnlyRunResult[]> {
  if (parallel) {
    const results = await Promise.all(
      Array.from({ length: runs }, (_, i) =>
        runSingleLlmPlan(apiIr, i + 1)
      )
    );
    return results.sort((a, b) => a.runNumber - b.runNumber);
  }

  const results: LlmOnlyRunResult[] = [];
  for (let i = 0; i < runs; i++) {
    const r = await runSingleLlmPlan(apiIr, i + 1);
    results.push(r);
  }
  return results;
}

/**
 * Evaluate a single ApiIR fixture.
 */
export async function evaluateLlmOnlyFixture(
  apiIrPath: string,
  runs: number,
  parallel = false
): Promise<LlmOnlyFixtureResult> {
  const fixtureName = apiIrPath.split("/").pop()?.replace(".json", "") ?? "unknown";
  const apiIr = loadApiIRFromFile(apiIrPath);

  const runResults = await runLlmOnlyEval(apiIr, runs, parallel);

  const validRuns = runResults.filter((r) => r.uiPlan !== null);
  const invalidRuns = runs - validRuns.length;

  const errors = [...new Set(runResults.filter((r) => r.error).map((r) => r.error!))];

  let averageSimilarity = 1;
  let minSimilarity = 1;
  let maxSimilarity = 1;

  let similarityDifferences: string[] | undefined;

  if (validRuns.length >= 2) {
    const fingerprints = validRuns.map((r) => r.fingerprint!);
    const comparisons: { i: number; j: number; similarity: number; differences: string[] }[] = [];

    for (let i = 0; i < fingerprints.length; i++) {
      for (let j = i + 1; j < fingerprints.length; j++) {
        const { similarity, differences } = compareUiPlanIRFingerprints(
          fingerprints[i],
          fingerprints[j]
        );
        comparisons.push({ i, j, similarity, differences });
      }
    }

    if (comparisons.length > 0) {
      const sims = comparisons.map((c) => c.similarity);
      averageSimilarity = sims.reduce((a, b) => a + b, 0) / sims.length;
      minSimilarity = Math.min(...sims);
      maxSimilarity = Math.max(...sims);

      if (minSimilarity < SIMILARITY_THRESHOLD) {
        const worst = comparisons.find((c) => c.similarity === minSimilarity);
        if (worst && worst.differences.length > 0) {
          similarityDifferences = worst.differences;
        }
      }
    }
  }

  const passed =
    validRuns.length / runs >= SIMILARITY_THRESHOLD &&
    minSimilarity >= SIMILARITY_THRESHOLD;

  return {
    fixtureName,
    apiIrPath,
    runs: runResults,
    totalRuns: runs,
    validRuns: validRuns.length,
    invalidRuns,
    averageSimilarity,
    minSimilarity,
    maxSimilarity,
    passed,
    errors,
    similarityDifferences,
  };
}

/**
 * Get list of ApiIR fixture paths.
 */
export function getApiIRFixtures(apiIrDir: string): string[] {
  if (!existsSync(apiIrDir)) {
    return [];
  }
  return readdirSync(apiIrDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(apiIrDir, f));
}
