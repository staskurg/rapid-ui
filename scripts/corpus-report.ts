#!/usr/bin/env tsx
/**
 * Phase 4 corpus report: generate markdown report from raw corpus run output.
 *
 * Usage: npm run corpus:report -- scripts/corpus-data/reports/raw-batch{N}-{timestamp}.json
 * Output: scripts/corpus-data/reports/report-batch{N}-{timestamp}.md
 *
 * Language Analysis: For passing specs, re-compiles to ApiIR and reports
 * resource shape, CRUD pattern, grouping strategy, spec complexity.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { buildApiIR } from "@/lib/compiler/apiir";
import { groupOperations } from "@/lib/compiler/apiir/grouping";
import {
  analyzeResourceShape,
  analyzeCrudPattern,
  analyzeGroupingStrategy,
  analyzeSpecComplexity,
  formatResourceShapeReport,
  formatCrudPatternReport,
  formatGroupingStrategyReport,
  formatSpecComplexityReport,
} from "./corpus-data/analyze-apiir";

interface CorpusError {
  code: string;
  message: string;
  jsonPointer?: string;
}

interface CorpusResult {
  path: string;
  valid: boolean;
  errors: CorpusError[];
  violationCount: number;
  compileTimeMs: number;
  crashed: boolean;
  parseFailed: boolean;
  parseError?: string;
  openapiVersion?: string;
  resourceCount?: number;
  fieldCount?: number;
}

interface RawOutput {
  meta: {
    batch: number;
    sampleSize: number;
    timestamp: string;
    cleanList: Array< { id: string; path: string; openapiVersion?: string } >;
  };
  results: CorpusResult[];
}

type FixCost = "trivial" | "medium" | "hard";

const TRIVIAL_CATEGORIES = new Set([
  "example",
  "default",
  "multiple success",
  "multiple success responses",
]);

const MEDIUM_CATEGORIES = new Set([
  "external ref",
  "external $ref",
  "allOf",
  "oneOf",
  "anyOf",
  "circular ref",
]);

const HARD_CATEGORIES = new Set([
  "nested paths",
  "multiple path params",
  "complex polymorphism",
  "root schema primitive",
]);

function categorizeError(code: string, message: string): string {
  const msg = message.toLowerCase();
  const codeLower = code.toLowerCase();

  if (codeLower.includes("unsupported_schema") || msg.includes("unsupported schema keyword")) {
    if (msg.includes("oneof") || msg.includes("anyof") || msg.includes("allof")) return "oneOf / anyOf / allOf";
    if (msg.includes("example")) return "example keyword";
    if (msg.includes("default")) return "default keyword";
    if (msg.includes("pattern")) return "pattern keyword";
    return "other unsupported schema keyword";
  }
  if (codeLower.includes("invalid_schema_shape")) return "schema shape / hygiene";
  if (codeLower.includes("invalid_operation")) return "operation structure";
  if (codeLower.includes("invalid_response") || codeLower.includes("multiple_success")) {
    if (msg.includes("resolve to object or array") || msg.includes("root success schema")) return "root schema primitive";
    if (msg.includes("must have schema")) return "response schema empty";
    if (msg.includes("application/json") || msg.includes("content")) return "response content type";
    return "response structure (other)";
  }
  if (msg.includes("multiple success")) return "multiple success responses";
  if (codeLower.includes("invalid_parameter")) return "parameter invalid";
  if (codeLower.includes("external_ref")) return "external $ref";
  if (codeLower.includes("circular_ref")) return "circular $ref";
  if (codeLower.includes("ambiguous_resource")) return "ambiguous grouping / multiple tags";
  if (codeLower.includes("missing_request_body")) return "missing request body";
  if (codeLower.includes("multiple_path_params")) return "multiple path params";
  if (codeLower.includes("parse_error") || codeLower.includes("parse error")) return "parse error";
  if (codeLower.includes("compiler_crash")) return "compiler crash";
  return "other";
}

function categoryToFixCost(cat: string): FixCost {
  const c = cat.toLowerCase();
  for (const x of TRIVIAL_CATEGORIES) {
    if (c.includes(x.replace(" ", "")) || c.includes(x)) return "trivial";
  }
  for (const x of MEDIUM_CATEGORIES) {
    if (c.includes(x.replace(" ", "")) || c.includes(x) || c.includes("$ref")) return "medium";
  }
  for (const x of HARD_CATEGORIES) {
    if (c.includes(x.replace(" ", "")) || c.includes(x)) return "hard";
  }
  if (c.includes("multiple path") || c.includes("nested")) return "hard";
  if (c.includes("external") || c.includes("allof") || c.includes("oneof") || c.includes("anyof")) return "medium";
  if (c.includes("example") || c.includes("default") || c.includes("multiple success")) return "trivial";
  return "medium";
}

function compileValidSpecsToApiIR(
  validPaths: string[],
  cwd: string
): Array<{ apiIr: import("@/lib/compiler/apiir").ApiIR; strategy: "tag" | "path" }> {
  const out: Array<{ apiIr: import("@/lib/compiler/apiir").ApiIR; strategy: "tag" | "path" }> = [];
  for (const relPath of validPaths) {
    const absPath = join(cwd, relPath);
    if (!existsSync(absPath)) continue;
    let content: string;
    try {
      content = readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }
    const parseResult = parseOpenAPI(content);
    if (!parseResult.success) continue;
    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) continue;
    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) continue;
    const buildResult = buildApiIR(resolveResult.doc);
    if (!buildResult.success) continue;
    const paths = resolveResult.doc.paths as Record<string, unknown>;
    const groupResult = groupOperations(paths);
    if (!groupResult.success) continue;
    out.push({ apiIr: buildResult.apiIr, strategy: groupResult.strategy });
  }
  return out;
}

function getLocationFromPointer(ptr: string | undefined): string {
  if (!ptr) return "unknown";
  if (ptr.startsWith("/paths/") && ptr.includes("/responses")) return "responses";
  if (ptr.startsWith("/paths/") && ptr.includes("/requestBody")) return "request bodies";
  if (ptr.startsWith("/paths/") && ptr.includes("/parameters")) return "parameters";
  if (ptr.startsWith("/paths/")) return "paths / operations";
  if (ptr.startsWith("/components/schemas")) return "schema definitions";
  return "other";
}

function collectAllErrors(results: CorpusResult[]): Array<{ code: string; message: string; category: string; location: string }> {
  const out: Array<{ code: string; message: string; category: string; location: string }> = [];
  for (const r of results) {
    if (r.parseFailed || r.crashed) continue;
    for (const e of r.errors) {
      const cat = categorizeError(e.code, e.message);
      const loc = getLocationFromPointer(e.jsonPointer);
      out.push({ code: e.code, message: e.message, category: cat, location: loc });
    }
  }
  return out;
}

function main(): number {
  const rawPath = process.argv[2];
  if (!rawPath) {
    console.error("Usage: npm run corpus:report -- <path-to-raw-batchN-timestamp.json>");
    console.error("Example: npm run corpus:report -- scripts/corpus-data/reports/raw-batch20-2026-03-04T12-30-45.json");
    return 1;
  }

  const absPath = join(process.cwd(), rawPath);
  if (!existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    return 1;
  }

  let data: RawOutput;
  try {
    data = JSON.parse(readFileSync(absPath, "utf-8"));
  } catch (err) {
    console.error(`Failed to parse JSON: ${err}`);
    return 1;
  }

  const { meta, results } = data;
  const validResults = results.filter((r) => r.valid && !r.parseFailed && !r.crashed);
  const invalidResults = results.filter((r) => !r.valid && !r.parseFailed && !r.crashed);
  const parseFailCount = results.filter((r) => r.parseFailed).length;
  const crashCount = results.filter((r) => r.crashed).length;

  const validCount = validResults.length;
  const total = results.length;
  const passRate = total > 0 ? (validCount / total) * 100 : 0;

  const singleViolation = invalidResults.filter((r) => r.violationCount === 1);
  const nearPassPct = total > 0 ? (singleViolation.length / total) * 100 : 0;

  const allErrors = collectAllErrors(results);
  const categoryCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};
  const fixCostCounts: Record<FixCost, number> = { trivial: 0, medium: 0, hard: 0 };

  for (const e of allErrors) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;
    locationCounts[e.location] = (locationCounts[e.location] ?? 0) + 1;
    const cost = categoryToFixCost(e.category);
    fixCostCounts[cost]++;
  }

  const totalInvalidSpecs = invalidResults.length;
  const trivialSpecs = new Set<string>();
  const mediumSpecs = new Set<string>();
  const hardSpecs = new Set<string>();
  for (const r of invalidResults) {
    const primary = r.errors[0];
    if (!primary) continue;
    const cat = categorizeError(primary.code, primary.message);
    const cost = categoryToFixCost(cat);
    if (cost === "trivial") trivialSpecs.add(r.path);
    else if (cost === "medium") mediumSpecs.add(r.path);
    else hardSpecs.add(r.path);
  }
  const trivialPct = totalInvalidSpecs > 0 ? (trivialSpecs.size / totalInvalidSpecs) * 100 : 0;
  const mediumPct = totalInvalidSpecs > 0 ? (mediumSpecs.size / totalInvalidSpecs) * 100 : 0;
  const hardPct = totalInvalidSpecs > 0 ? (hardSpecs.size / totalInvalidSpecs) * 100 : 0;

  const easyFixRate = trivialPct; // "easy fix" = trivial
  const naturalFit = passRate + easyFixRate;

  const compileTimes = results.filter((r) => !r.parseFailed).map((r) => r.compileTimeMs);
  const avgCompileMs = compileTimes.length > 0
    ? compileTimes.reduce((a, b) => a + b, 0) / compileTimes.length
    : 0;
  const maxCompileMs = compileTimes.length > 0 ? Math.max(...compileTimes) : 0;

  const resourceCounts = validResults.map((r) => r.resourceCount ?? 0).filter((n) => n > 0);
  const fieldCounts = validResults.map((r) => r.fieldCount ?? 0).filter((n) => n > 0);
  const totalResources = resourceCounts.reduce((a, b) => a + b, 0);
  const totalFields = fieldCounts.reduce((a, b) => a + b, 0);
  const avgResources = resourceCounts.length > 0
    ? resourceCounts.reduce((a, b) => a + b, 0) / resourceCounts.length
    : 0;
  const avgFieldsPerResource =
    totalResources > 0 ? totalFields / totalResources : 0;

  // Language Analysis (passing specs only) — re-compile to ApiIR for stats
  const cwd = process.cwd();
  const validPaths = validResults.map((r) => r.path);
  const apiIrResults = compileValidSpecsToApiIR(validPaths, cwd);

  const mergedResourceShape = {
    fieldsPerResource: [] as number[],
    requiredFields: [] as number[],
    enumFields: [] as number[],
    arrayFields: [] as number[],
    nestedDepth: [] as number[],
  };
  let crudList = 0;
  let crudDetail = 0;
  let crudCreate = 0;
  let crudUpdate = 0;
  let crudDelete = 0;
  let crudResourceCount = 0;
  let groupingTag = 0;
  let groupingPath = 0;
  const specComplexityStats: Array<{ resourcesPerSpec: number[]; operationsPerResource: number[] }> = [];

  for (const { apiIr, strategy } of apiIrResults) {
    const shape = analyzeResourceShape(apiIr);
    mergedResourceShape.fieldsPerResource.push(...shape.fieldsPerResource);
    mergedResourceShape.requiredFields.push(...shape.requiredFields);
    mergedResourceShape.enumFields.push(...shape.enumFields);
    mergedResourceShape.arrayFields.push(...shape.arrayFields);
    mergedResourceShape.nestedDepth.push(...shape.nestedDepth);

    const crud = analyzeCrudPattern(apiIr);
    crudList += crud.list;
    crudDetail += crud.detail;
    crudCreate += crud.create;
    crudUpdate += crud.update;
    crudDelete += crud.delete;
    crudResourceCount += crud.resourceCount;

    const gs = analyzeGroupingStrategy(strategy);
    groupingTag += gs.tag;
    groupingPath += gs.path;

    specComplexityStats.push(analyzeSpecComplexity(apiIr));
  }

  const versionCounts: Record<string, number> = {};
  for (const item of meta.cleanList) {
    const v = item.openapiVersion ?? "unknown";
    const prefix = v.startsWith("3.1") ? "3.1.x" : v.startsWith("3.0") ? "3.0.x" : "other";
    versionCounts[prefix] = (versionCounts[prefix] ?? 0) + 1;
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const topSingleReasons: Record<string, number> = {};
  for (const r of singleViolation) {
    const e = r.errors[0];
    if (!e) continue;
    const cat = categorizeError(e.code, e.message);
    topSingleReasons[cat] = (topSingleReasons[cat] ?? 0) + 1;
  }
  const topSingle = Object.entries(topSingleReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const reportDir = dirname(absPath);
  const rawBase = rawPath.split("/").pop() ?? rawPath;
  const reportBase = rawBase.replace(/^raw-/, "report-").replace(/\.json$/, ".md");
  const reportPath = join(reportDir, reportBase);

  const lines: string[] = [];

  lines.push("# RapidUI RUS-v1 Corpus Report");
  lines.push("");
  lines.push(`**Date:** ${new Date().toISOString().split("T")[0]}`);
  lines.push(`**Batch:** ${meta.batch}`);
  lines.push("");
  lines.push("## SAMPLING METHOD");
  lines.push("");
  lines.push("Source: APIs.guru (via openapi-directory)");
  lines.push(`Selection: Batch ${meta.batch}`);
  lines.push(`Total in batch: ${meta.sampleSize}`);
  lines.push(`Sample size: ${meta.sampleSize}`);
  lines.push("");
  lines.push("## LAYER 1: COMPATIBILITY");
  lines.push("");
  lines.push(`Total specs tested: ${total}`);
  lines.push(`Valid (RUS-v1 compliant): ${validCount}`);
  lines.push(`Pass rate: ${validCount}/${total} (${passRate.toFixed(1)}%)`);
  lines.push(`Near-pass (single violation): ${singleViolation.length} specs (${nearPassPct.toFixed(1)}%)`);
  lines.push("Endpoint coverage: N/A (deferred to v2)");
  lines.push(`Fix cost: Low ${trivialPct.toFixed(0)}% | Medium ${mediumPct.toFixed(0)}% | High ${hardPct.toFixed(0)}%`);
  lines.push(`Natural Fit Score: pass_rate + easy_fix_rate = ${naturalFit.toFixed(1)}%`);
  lines.push("");
  lines.push("### NEAR-PASS ANALYSIS");
  lines.push("");
  lines.push(`Specs failing with only one violation: ${nearPassPct.toFixed(1)}%`);
  lines.push("");
  lines.push("Top single-failure reasons:");
  for (const [cat, count] of topSingle) {
    const pct = singleViolation.length > 0 ? (count / singleViolation.length) * 100 : 0;
    lines.push(`- ${cat}: ${count} (${pct.toFixed(0)}%)`);
  }
  lines.push("");
  lines.push("## LAYER 2: ECOSYSTEM");
  lines.push("");
  lines.push("Schema reuse / ref graph: N/A (requires spec re-read)");
  lines.push("");
  lines.push("### LANGUAGE ANALYSIS (passing specs)");
  lines.push("");
  lines.push("Resource shape, CRUD coverage, grouping strategy, spec complexity — from ApiIR.");
  lines.push("");
  if (apiIrResults.length > 0) {
    lines.push("#### Resource Shape Distribution");
    lines.push("");
    for (const line of formatResourceShapeReport(mergedResourceShape)) {
      lines.push(line);
    }
    lines.push("");
    lines.push("#### CRUD Pattern Distribution");
    lines.push("");
    for (const line of formatCrudPatternReport({
      list: crudList,
      detail: crudDetail,
      create: crudCreate,
      update: crudUpdate,
      delete: crudDelete,
      resourceCount: crudResourceCount,
    })) {
      lines.push(line);
    }
    lines.push("");
    lines.push("#### Resource Grouping Strategy");
    lines.push("");
    for (const line of formatGroupingStrategyReport(groupingTag, groupingPath)) {
      lines.push(line);
    }
    lines.push("");
    lines.push("#### Spec Complexity Distribution");
    lines.push("");
    for (const line of formatSpecComplexityReport(specComplexityStats)) {
      lines.push(line);
    }
  } else {
    lines.push("No passing specs — language analysis skipped.");
  }
  lines.push("");
  lines.push("### OpenAPI Version Distribution");
  lines.push("");
  const totalVer = Object.values(versionCounts).reduce((a, b) => a + b, 0);
  for (const [ver, count] of Object.entries(versionCounts).sort()) {
    const pct = totalVer > 0 ? (count / totalVer) * 100 : 0;
    lines.push(`- ${ver}: ${count} (${pct.toFixed(1)}%)`);
  }
  lines.push("");
  lines.push("## LAYER 3: LANGUAGE DESIGN");
  lines.push("");
  lines.push("### Rejection Reasons (frequency)");
  lines.push("");
  const totalErr = allErrors.length;
  for (const [cat, count] of topCategories) {
    const pct = totalErr > 0 ? (count / totalErr) * 100 : 0;
    lines.push(`- ${cat}: ${count} (${pct.toFixed(1)}%)`);
  }
  lines.push("");
  lines.push("### Failure Location");
  lines.push("");
  const locEntries = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
  for (const [loc, count] of locEntries) {
    const pct = totalErr > 0 ? (count / totalErr) * 100 : 0;
    lines.push(`- ${loc}: ${count} (${pct.toFixed(1)}%)`);
  }
  lines.push("");
  lines.push("### Feature Presence (valid specs)");
  lines.push("");
  lines.push("N/A (requires spec re-read for schema traversal)");
  lines.push("");
  lines.push("### Compatibility Projection");
  lines.push("");
  lines.push(`Current pass rate: ${passRate.toFixed(1)}%`);
  lines.push("Projected gains if rules relaxed: (see RUS-v2 roadmap)");
  lines.push("");
  lines.push("## LAYER 4: SYSTEM HEALTH");
  lines.push("");
  lines.push("Determinism: Skipped for v1");
  lines.push(`Compile time: avg ${avgCompileMs.toFixed(0)} ms, max ${maxCompileMs} ms`);
  lines.push(`Compiler crashes: ${crashCount}`);
  lines.push(`Parse failures: ${parseFailCount} (excluded from crash count)`);
  lines.push("");
  lines.push("### IR Metrics (valid specs)");
  lines.push("");
  lines.push(`Average resources per API: ${avgResources.toFixed(1)}`);
  lines.push(`Average fields per resource: ${avgFieldsPerResource.toFixed(1)}`);
  lines.push("");
  lines.push("## RUS-v2 ROADMAP IMPLICATIONS");
  lines.push("");
  lines.push("Top expansion candidates (by rejection frequency):");
  for (let i = 0; i < Math.min(5, topCategories.length); i++) {
    lines.push(`${i + 1}. ${topCategories[i][0]}`);
  }
  lines.push("");
  lines.push("## EXAMPLES");
  lines.push("");
  if (validResults.length > 0) {
    lines.push("### Example PASS");
    const ex = validResults[0];
    lines.push(`- Path: ${ex.path}`);
    lines.push(`- Resources: ${ex.resourceCount ?? "N/A"}`);
    lines.push("");
  }
  if (invalidResults.length > 0) {
    lines.push("### Example FAIL");
    const ex = invalidResults[0];
    lines.push(`- Path: ${ex.path}`);
    lines.push(`- Reason: ${ex.errors[0]?.message ?? "unknown"}`);
    lines.push(`- Code: ${ex.errors[0]?.code ?? "unknown"}`);
  }
  lines.push("");

  const reportContent = lines.join("\n");
  writeFileSync(reportPath, reportContent, "utf-8");

  console.log(`Report written to: ${reportPath}`);
  return 0;
}

process.exit(main());
