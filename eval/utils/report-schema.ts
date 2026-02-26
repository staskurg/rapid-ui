/**
 * Shared types and JSON report builder for eval reports.
 * Machine-readable format for CI, trend analysis, prompt debugging.
 */

import type { MultiSpecDiff } from "@/lib/spec/diff";

export type EvalType = "full" | "llm-only";

export interface ReportConfig {
  runs: number;
  parallel: boolean;
}

export interface ReportSummary {
  passed: boolean;
  validity: number;
  minSimilarity: number;
  totalRuns: number;
  totalValid: number;
}

export interface FixtureDiff {
  structural?: string[];
  unified?: string;
  multiSpecDiff?: MultiSpecDiff;
}

export interface FixtureReport {
  fixtureName: string;
  validRuns: number;
  totalRuns: number;
  minSimilarity: number;
  passed: boolean;
  errors: string[];
  worstPair?: { runA: number; runB: number; similarity: number };
  diff?: FixtureDiff;
}

export interface EvalJsonReport {
  evalType: EvalType;
  timestamp: string;
  config: ReportConfig;
  summary: ReportSummary;
  fixtures: FixtureReport[];
}

export interface FullFixtureResult {
  fixtureName: string;
  validRuns: number;
  runs: { length: number };
  minSimilarity: number;
  passed: boolean;
  errors: string[];
  worstPair?: {
    runA: number;
    runB: number;
    similarity: number;
    structuralDifferences: string[];
  };
  multiSpecDiff?: MultiSpecDiff;
  unifiedDiff?: string;
}

/**
 * Build JSON report for full pipeline eval.
 */
export function buildFullReport(
  config: { runs: number; parallel: boolean },
  results: FullFixtureResult[],
  totalRuns: number,
  totalValid: number,
  validityRate: number,
  minSimAcross: number,
  allPassed: boolean
): EvalJsonReport {
  const fixtures: FixtureReport[] = results.map((r) => {
    const diff: FixtureDiff = {};
    // Include diffs whenever there's drift (< 100%), not just on failure
    if (r.minSimilarity < 1 && r.worstPair) {
      if (r.worstPair.structuralDifferences?.length) diff.structural = r.worstPair.structuralDifferences;
      if (r.unifiedDiff) diff.unified = r.unifiedDiff;
      if (r.multiSpecDiff) diff.multiSpecDiff = r.multiSpecDiff;
    }
    return {
      fixtureName: r.fixtureName,
      validRuns: r.validRuns,
      totalRuns: r.runs.length,
      minSimilarity: r.minSimilarity,
      passed: r.passed,
      errors: r.errors,
      worstPair: r.worstPair
        ? { runA: r.worstPair.runA, runB: r.worstPair.runB, similarity: r.worstPair.similarity }
        : undefined,
      diff: Object.keys(diff).length > 0 ? diff : undefined,
    };
  });

  return {
    evalType: "full",
    timestamp: new Date().toISOString(),
    config: { runs: config.runs, parallel: config.parallel },
    summary: {
      passed: allPassed,
      validity: validityRate,
      minSimilarity: minSimAcross,
      totalRuns,
      totalValid,
    },
    fixtures,
  };
}

/**
 * Build JSON report for LLM-only eval.
 */
export function buildLlmOnlyReport(
  config: { runs: number; parallel: boolean },
  results: Array<{
    fixtureName: string;
    validRuns: number;
    totalRuns: number;
    minSimilarity: number;
    passed: boolean;
    errors: string[];
    worstPair?: { runA: number; runB: number; similarity: number };
    similarityDifferences?: string[];
    unifiedDiff?: string;
  }>,
  totalRuns: number,
  totalValid: number,
  validityRate: number,
  minSimAcross: number,
  allPassed: boolean
): EvalJsonReport {
  const fixtures: FixtureReport[] = results.map((r) => {
    const diff: FixtureDiff = {};
    // Include diffs whenever there's drift (< 100%), not just on failure
    if (r.minSimilarity < 1) {
      if (r.similarityDifferences?.length) diff.structural = r.similarityDifferences;
      if (r.unifiedDiff) diff.unified = r.unifiedDiff;
    }
    return {
      fixtureName: r.fixtureName,
      validRuns: r.validRuns,
      totalRuns: r.totalRuns,
      minSimilarity: r.minSimilarity,
      passed: r.passed,
      errors: r.errors,
      worstPair: r.worstPair,
      diff: Object.keys(diff).length > 0 ? diff : undefined,
    };
  });

  return {
    evalType: "llm-only",
    timestamp: new Date().toISOString(),
    config: { runs: config.runs, parallel: config.parallel },
    summary: {
      passed: allPassed,
      validity: validityRate,
      minSimilarity: minSimAcross,
      totalRuns,
      totalValid,
    },
    fixtures,
  };
}
