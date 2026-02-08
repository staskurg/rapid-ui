/**
 * Report generation utilities for evaluation results
 */

import type { UISpec } from "@/lib/spec/types";
import type { ValidationResult, LogicalIntegrityResult } from "./validator";
import type { StructuralFingerprint } from "./comparator";

export interface RunResult {
  runNumber: number;
  spec: UISpec | null;
  rawResponse: string | null;
  source: "ai" | "fallback";
  validationResult: ValidationResult;
  logicalResult: LogicalIntegrityResult | null;
  fingerprint: StructuralFingerprint | null;
  error?: string;
}

export interface FixtureResult {
  fixtureName: string;
  runs: RunResult[];
  totalRuns: number;
  validRuns: number;
  invalidRuns: number;
  fallbackRuns: number;
  averageSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  consistent: boolean;
  errors: string[];
  warnings: string[];
}

export interface EvaluationReport {
  timestamp: string;
  totalFixtures: number;
  totalRuns: number;
  overallValidRate: number;
  overallStability: number;
  fixtureResults: FixtureResult[];
}

/**
 * Generate markdown report from evaluation results
 */
export function generateMarkdownReport(
  report: EvaluationReport
): string {
  const lines: string[] = [];

  lines.push("# AI Evaluation Report");
  lines.push("");
  lines.push(`**Generated:** ${report.timestamp}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Total Fixtures:** ${report.totalFixtures}`);
  lines.push(`- **Total Runs:** ${report.totalRuns}`);
  lines.push(
    `- **Overall Valid Rate:** ${(report.overallValidRate * 100).toFixed(1)}%`
  );
  lines.push(
    `- **Overall Stability:** ${(report.overallStability * 100).toFixed(1)}%`
  );
  lines.push("");

  // Per-fixture results
  lines.push("## Per-Fixture Results");
  lines.push("");

  report.fixtureResults.forEach((fixture) => {
    lines.push(`### ${fixture.fixtureName}`);
    lines.push("");
    lines.push(`- **Runs:** ${fixture.totalRuns}`);
    lines.push(
      `- **Valid Specs:** ${fixture.validRuns}/${fixture.totalRuns} (${(
        (fixture.validRuns / fixture.totalRuns) *
        100
      ).toFixed(1)}%)`
    );
    lines.push(`- **Fallback Runs:** ${fixture.fallbackRuns}`);
    // Use similarity threshold (≥90%) instead of just consistent flag
    const stabilityLabel = fixture.averageSimilarity >= 0.9 ? "High" : "Low";
    lines.push(
      `- **Stability:** ${stabilityLabel} (avg similarity: ${(
        fixture.averageSimilarity * 100
      ).toFixed(1)}%)`
    );

    if (fixture.errors.length > 0) {
      lines.push("");
      lines.push("**Errors:**");
      fixture.errors.forEach((error) => {
        lines.push(`- ${error}`);
      });
    }

    if (fixture.warnings.length > 0) {
      lines.push("");
      lines.push("**Warnings:**");
      fixture.warnings.forEach((warning) => {
        lines.push(`- ${warning}`);
      });
    }

    if (!fixture.consistent && fixture.averageSimilarity < 0.9) {
      lines.push("");
      lines.push("**Stability Issues:**");
      lines.push(
        `- Structural drift detected (similarity: ${(
          fixture.averageSimilarity * 100
        ).toFixed(1)}%)`
      );
      lines.push(`- Min similarity: ${(fixture.minSimilarity * 100).toFixed(1)}%`);
      lines.push(`- Max similarity: ${(fixture.maxSimilarity * 100).toFixed(1)}%`);
    }

    lines.push("");
  });

  // Overall assessment
  lines.push("## Overall Assessment");
  lines.push("");

  if (report.overallValidRate >= 0.9) {
    lines.push("✅ **Valid Rate:** Meets target (≥90%)");
  } else {
    lines.push(
      `⚠️ **Valid Rate:** Below target (${(report.overallValidRate * 100).toFixed(1)}% < 90%)`
    );
  }

  if (report.overallStability >= 0.9) {
    lines.push("✅ **Stability:** High structural consistency");
  } else {
    lines.push(
      `⚠️ **Stability:** Low structural consistency (${(report.overallStability * 100).toFixed(1)}%)`
    );
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Generate text report (simpler format)
 */
export function generateTextReport(report: EvaluationReport): string {
  const lines: string[] = [];

  lines.push("AI Evaluation Report");
  lines.push("=".repeat(50));
  lines.push(`Generated: ${report.timestamp}`);
  lines.push("");
  lines.push(`Total Fixtures: ${report.totalFixtures}`);
  lines.push(`Total Runs: ${report.totalRuns}`);
  lines.push(
    `Overall Valid Rate: ${(report.overallValidRate * 100).toFixed(1)}%`
  );
  lines.push(
    `Overall Stability: ${(report.overallStability * 100).toFixed(1)}%`
  );
  lines.push("");

  report.fixtureResults.forEach((fixture) => {
    lines.push(`Fixture: ${fixture.fixtureName}`);
    lines.push(`  Runs: ${fixture.totalRuns}`);
    lines.push(
      `  Valid specs: ${fixture.validRuns}/${fixture.totalRuns} (${(
        (fixture.validRuns / fixture.totalRuns) *
        100
      ).toFixed(1)}%)`
    );
    lines.push(`  Fallback runs: ${fixture.fallbackRuns}`);
    // Use similarity threshold (≥90%) instead of just consistent flag
    const stabilityLabel = fixture.averageSimilarity >= 0.9 ? "high" : "low";
    lines.push(
      `  Stability: ${stabilityLabel} (avg: ${(
        fixture.averageSimilarity * 100
      ).toFixed(1)}%)`
    );

    if (fixture.errors.length > 0) {
      lines.push(`  Errors: ${fixture.errors.join("; ")}`);
    }

    lines.push("");
  });

  return lines.join("\n");
}
