#!/usr/bin/env tsx
/**
 * Phase 4 corpus report: generate markdown report from raw corpus run output.
 *
 * Usage: npm run corpus:report -- [--repo REPO] [path-to-raw-output.json]
 *   --repo REPO: api-guru | github — auto-finds latest raw-{repo}-*.json if path omitted
 *   path: explicit path to raw output JSON
 *
 * Output: scripts/corpus-data/reports/report-{name}-{timestamp}.md
 *
 * Language Analysis: For passing specs, re-compiles to ApiIR and reports
 * resource shape, CRUD pattern, grouping strategy, spec complexity.
 */

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { parseOpenAPI } from '@/lib/compiler/openapi/parser';
import { validateSubset } from '@/lib/compiler/openapi/subset-validator';
import { resolveRefs } from '@/lib/compiler/openapi/ref-resolver';
import { buildApiIR } from '@/lib/compiler/apiir';
import { groupOperations } from '@/lib/compiler/apiir/grouping';
import {
  analyzeResourceShape,
  analyzeCrudPattern,
  analyzeGroupingStrategy,
  analyzeSpecComplexity,
  formatResourceShapeReport,
  formatCrudPatternReport,
  formatGroupingStrategyReport,
  formatSpecComplexityReport,
} from './corpus-data/analyze-apiir';

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
    batch: number | string;
    sampleSize: number;
    timestamp: string;
    cleanList: Array<{ id: string; path: string; openapiVersion?: string }>;
  };
  results: CorpusResult[];
}

type FixCost = 'trivial' | 'medium' | 'hard';

const TRIVIAL_CATEGORIES = new Set([
  'example',
  'default',
  'multiple success',
  'multiple success responses',
]);

const MEDIUM_CATEGORIES = new Set([
  'external ref',
  'external $ref',
  'allOf',
  'oneOf',
  'anyOf',
  'circular ref',
]);

const HARD_CATEGORIES = new Set([
  'nested paths',
  'multiple path params',
  'complex polymorphism',
  'root schema primitive',
]);

function categorizeError(code: string, message: string): string {
  const msg = message.toLowerCase();
  const codeLower = code.toLowerCase();

  if (codeLower.includes('unsupported_schema') || msg.includes('unsupported schema keyword')) {
    if (msg.includes('oneof') || msg.includes('anyof') || msg.includes('allof'))
      return 'oneOf / anyOf / allOf';
    if (msg.includes('example')) return 'example keyword';
    if (msg.includes('default')) return 'default keyword';
    if (msg.includes('pattern')) return 'pattern keyword';
    return 'other unsupported schema keyword';
  }
  if (codeLower.includes('invalid_schema_shape')) return 'schema shape / hygiene';
  if (codeLower.includes('invalid_operation')) return 'operation structure';
  if (codeLower.includes('invalid_response') || codeLower.includes('multiple_success')) {
    if (msg.includes('resolve to object or array') || msg.includes('root success schema'))
      return 'root schema primitive';
    if (msg.includes('must have schema')) return 'response schema empty';
    if (msg.includes('application/json') || msg.includes('content')) return 'response content type';
    return 'response structure (other)';
  }
  if (msg.includes('multiple success')) return 'multiple success responses';
  if (codeLower.includes('invalid_parameter')) return 'parameter invalid';
  if (codeLower.includes('external_ref')) return 'external $ref';
  if (codeLower.includes('circular_ref')) return 'circular $ref';
  if (codeLower.includes('ambiguous_resource')) return 'ambiguous grouping / multiple tags';
  if (codeLower.includes('missing_request_body')) return 'missing request body';
  if (codeLower.includes('multiple_path_params')) return 'multiple path params';
  if (codeLower.includes('parse_error') || codeLower.includes('parse error')) return 'parse error';
  if (codeLower.includes('compiler_crash')) return 'compiler crash';
  return 'other';
}

function categoryToFixCost(cat: string): FixCost {
  const c = cat.toLowerCase();
  for (const x of TRIVIAL_CATEGORIES) {
    if (c.includes(x.replace(' ', '')) || c.includes(x)) return 'trivial';
  }
  for (const x of MEDIUM_CATEGORIES) {
    if (c.includes(x.replace(' ', '')) || c.includes(x) || c.includes('$ref')) return 'medium';
  }
  for (const x of HARD_CATEGORIES) {
    if (c.includes(x.replace(' ', '')) || c.includes(x)) return 'hard';
  }
  if (c.includes('multiple path') || c.includes('nested')) return 'hard';
  if (c.includes('external') || c.includes('allof') || c.includes('oneof') || c.includes('anyof'))
    return 'medium';
  if (c.includes('example') || c.includes('default') || c.includes('multiple success'))
    return 'trivial';
  return 'medium';
}

function compileValidSpecsToApiIR(
  validPaths: string[],
  cwd: string
): Array<{ apiIr: import('@/lib/compiler/apiir').ApiIR; strategy: 'tag' | 'path' }> {
  const out: Array<{ apiIr: import('@/lib/compiler/apiir').ApiIR; strategy: 'tag' | 'path' }> = [];
  for (const relPath of validPaths) {
    const absPath = join(cwd, relPath);
    if (!existsSync(absPath)) continue;
    let content: string;
    try {
      content = readFileSync(absPath, 'utf-8');
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
  if (!ptr) return 'unknown';
  if (ptr.startsWith('/paths/') && ptr.includes('/responses')) return 'responses';
  if (ptr.startsWith('/paths/') && ptr.includes('/requestBody')) return 'request bodies';
  if (ptr.startsWith('/paths/') && ptr.includes('/parameters')) return 'parameters';
  if (ptr.startsWith('/paths/')) return 'paths / operations';
  if (ptr.startsWith('/components/schemas')) return 'schema definitions';
  return 'other';
}

function collectAllErrors(
  results: CorpusResult[]
): Array<{ code: string; message: string; category: string; location: string }> {
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

/** Collect errors with spec path for granular breakdown and example specs. */
function collectAllErrorsWithPath(
  results: CorpusResult[]
): Array<{ code: string; message: string; category: string; location: string; specPath: string }> {
  const out: Array<{
    code: string;
    message: string;
    category: string;
    location: string;
    specPath: string;
  }> = [];
  for (const r of results) {
    if (r.parseFailed || r.crashed) continue;
    for (const e of r.errors) {
      const cat = categorizeError(e.code, e.message);
      const loc = getLocationFromPointer(e.jsonPointer);
      out.push({
        code: e.code,
        message: e.message,
        category: cat,
        location: loc,
        specPath: r.path,
      });
    }
  }
  return out;
}

/** Build per-category, per-message breakdown with counts and example spec paths. */
function buildMessageBreakdown(
  errorsWithPath: Array<{ category: string; message: string; specPath: string }>,
  maxExamplesPerMessage = 5
): Record<string, Array<{ message: string; count: number; pct: number; examples: string[] }>> {
  const byCategory: Record<string, Record<string, { count: number; paths: Set<string> }>> = {};
  for (const e of errorsWithPath) {
    if (!byCategory[e.category]) byCategory[e.category] = {};
    if (!byCategory[e.category][e.message]) {
      byCategory[e.category][e.message] = { count: 0, paths: new Set() };
    }
    const entry = byCategory[e.category][e.message];
    entry.count++;
    if (entry.paths.size < maxExamplesPerMessage) entry.paths.add(e.specPath);
  }
  const out: Record<
    string,
    Array<{ message: string; count: number; pct: number; examples: string[] }>
  > = {};
  for (const [cat, messages] of Object.entries(byCategory)) {
    const totalInCat = Object.values(messages).reduce((s, m) => s + m.count, 0);
    out[cat] = Object.entries(messages)
      .map(([msg, { count, paths }]) => ({
        message: msg,
        count,
        pct: totalInCat > 0 ? (count / totalInCat) * 100 : 0,
        examples: [...paths].slice(0, maxExamplesPerMessage),
      }))
      .sort((a, b) => b.count - a.count);
  }
  return out;
}

/** Spec-level metrics for roadmap prioritization. */
interface SpecLevelMetrics {
  uniqueSpecsAffected: number;
  onlyBlockerSpecs: number;
  nearPassSpecs: number;
  rawInstances: number;
  top10SpecConcentrationPct: number;
  topOffendingSpecs: Array<{ path: string; count: number }>;
}

function buildSpecLevelMetrics(
  invalidResults: CorpusResult[],
  categorizeError: (code: string, message: string) => string
): Record<string, SpecLevelMetrics> {
  const byCategory: Record<string, { specs: Set<string>; specErrorCounts: Map<string, number> }> =
    {};
  const onlyBlockerByCategory: Record<string, Set<string>> = {};
  const nearPassByCategory: Record<string, Set<string>> = {};

  for (const r of invalidResults) {
    const categoriesInSpec = new Set<string>();
    const categoryCounts: Record<string, number> = {};

    for (const e of r.errors) {
      const cat = categorizeError(e.code, e.message);
      categoriesInSpec.add(cat);
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;

      if (!byCategory[cat]) {
        byCategory[cat] = { specs: new Set(), specErrorCounts: new Map() };
      }
      byCategory[cat].specs.add(r.path);
      const prev = byCategory[cat].specErrorCounts.get(r.path) ?? 0;
      byCategory[cat].specErrorCounts.set(r.path, prev + 1);
    }

    for (const cat of categoriesInSpec) {
      if (!onlyBlockerByCategory[cat]) onlyBlockerByCategory[cat] = new Set();
      if (categoriesInSpec.size === 1) onlyBlockerByCategory[cat].add(r.path);

      if (r.violationCount === 1 && categoriesInSpec.size === 1) {
        if (!nearPassByCategory[cat]) nearPassByCategory[cat] = new Set();
        nearPassByCategory[cat].add(r.path);
      }
    }
  }

  const out: Record<string, SpecLevelMetrics> = {};
  for (const [cat, data] of Object.entries(byCategory)) {
    const totalErrors = [...data.specErrorCounts.values()].reduce((a, b) => a + b, 0);
    const sortedSpecs = [...data.specErrorCounts.entries()].sort((a, b) => b[1] - a[1]);
    const top10 = sortedSpecs.slice(0, 10);
    const top10Errors = top10.reduce((s, [, c]) => s + c, 0);
    const top10Pct = totalErrors > 0 ? (top10Errors / totalErrors) * 100 : 0;

    out[cat] = {
      uniqueSpecsAffected: data.specs.size,
      onlyBlockerSpecs: onlyBlockerByCategory[cat]?.size ?? 0,
      nearPassSpecs: nearPassByCategory[cat]?.size ?? 0,
      rawInstances: totalErrors,
      top10SpecConcentrationPct: top10Pct,
      topOffendingSpecs: top10.map(([path, count]) => ({
        path: path.split('/').pop() ?? path,
        count,
      })),
    };
  }
  return out;
}

/** Normalize sub-rule message for grouping (collapse variable parts). */
function normalizeSubRuleMessage(cat: string, message: string): string {
  if (message.startsWith('required references non-existent property: ')) {
    return 'required references non-existent property: {name}';
  }
  if (message.startsWith('When $ref is present, only $ref and description are allowed; found: ')) {
    return 'When $ref is present, only $ref and description are allowed; found: {key}';
  }
  if (message.startsWith('Path has multiple path parameters: ')) {
    return 'Path has multiple path parameters: {params}';
  }
  if (message.startsWith('Unsupported schema keyword: ')) {
    return message; // Keep keyword name for schema keywords
  }
  return message;
}

/** Sub-rule (message) level metrics for implementation sequencing. */
interface SubRuleMetrics {
  subRule: string;
  specsAffected: number;
  onlyBlocker: number;
  nearPass: number;
  top10Pct: number;
}

const TOP_CATEGORIES_FOR_SUBRULE = [
  'schema shape / hygiene',
  'operation structure',
  'response content type',
];

const OTHER_BUCKET_CATEGORY = 'other';

const MAX_SUBRULES_PER_CATEGORY = 15;
const MAX_OTHER_SUBRULES = 25;

function buildSubRuleMetrics(
  invalidResults: CorpusResult[],
  categorizeError: (code: string, message: string) => string
): Record<string, SubRuleMetrics[]> {
  const byCatAndMsg: Record<
    string,
    Record<string, { specs: Set<string>; specErrorCounts: Map<string, number> }>
  > = {};
  const onlyBlockerByCatMsg: Record<string, Record<string, Set<string>>> = {};
  const nearPassByCatMsg: Record<string, Record<string, Set<string>>> = {};

  for (const r of invalidResults) {
    const messagesInSpec = new Set<string>();
    const msgCounts: Record<string, number> = {};

    for (const e of r.errors) {
      const cat = categorizeError(e.code, e.message);
      const norm = normalizeSubRuleMessage(cat, e.message);
      const key = `${cat}\0${norm}`;
      messagesInSpec.add(key);
      msgCounts[key] = (msgCounts[key] ?? 0) + 1;

      if (!byCatAndMsg[cat]) byCatAndMsg[cat] = {};
      if (!byCatAndMsg[cat][norm]) {
        byCatAndMsg[cat][norm] = { specs: new Set(), specErrorCounts: new Map() };
      }
      const entry = byCatAndMsg[cat][norm];
      entry.specs.add(r.path);
      const prev = entry.specErrorCounts.get(r.path) ?? 0;
      entry.specErrorCounts.set(r.path, prev + 1);
    }

    for (const key of messagesInSpec) {
      const [cat, msg] = key.split('\0');
      if (!msg) continue;
      if (!onlyBlockerByCatMsg[cat]) onlyBlockerByCatMsg[cat] = {};
      if (!onlyBlockerByCatMsg[cat][msg]) onlyBlockerByCatMsg[cat][msg] = new Set();
      if (messagesInSpec.size === 1) onlyBlockerByCatMsg[cat][msg].add(r.path);

      if (r.violationCount === 1 && messagesInSpec.size === 1) {
        if (!nearPassByCatMsg[cat]) nearPassByCatMsg[cat] = {};
        if (!nearPassByCatMsg[cat][msg]) nearPassByCatMsg[cat][msg] = new Set();
        nearPassByCatMsg[cat][msg].add(r.path);
      }
    }
  }

  const out: Record<string, SubRuleMetrics[]> = {};
  for (const cat of TOP_CATEGORIES_FOR_SUBRULE) {
    const messages = byCatAndMsg[cat];
    if (!messages) {
      out[cat] = [];
      continue;
    }
    out[cat] = Object.entries(messages)
      .map(([msg, data]) => {
        const totalErrors = [...data.specErrorCounts.values()].reduce((a, b) => a + b, 0);
        const sorted = [...data.specErrorCounts.entries()].sort((a, b) => b[1] - a[1]);
        const top10 = sorted.slice(0, 10);
        const top10Errors = top10.reduce((s, [, c]) => s + c, 0);
        const top10Pct = totalErrors > 0 ? (top10Errors / totalErrors) * 100 : 0;
        return {
          subRule: msg,
          specsAffected: data.specs.size,
          onlyBlocker: onlyBlockerByCatMsg[cat]?.[msg]?.size ?? 0,
          nearPass: nearPassByCatMsg[cat]?.[msg]?.size ?? 0,
          top10Pct,
        };
      })
      .sort((a, b) => b.specsAffected - a.specsAffected)
      .slice(0, MAX_SUBRULES_PER_CATEGORY);
  }
  // Other bucket breakdown (visibility only; simpler table)
  const otherMessages = byCatAndMsg[OTHER_BUCKET_CATEGORY];
  if (otherMessages) {
    out[OTHER_BUCKET_CATEGORY] = Object.entries(otherMessages)
      .map(([msg, data]) => ({
        subRule: msg,
        specsAffected: data.specs.size,
        onlyBlocker: onlyBlockerByCatMsg[OTHER_BUCKET_CATEGORY]?.[msg]?.size ?? 0,
        nearPass: nearPassByCatMsg[OTHER_BUCKET_CATEGORY]?.[msg]?.size ?? 0,
        top10Pct: 0,
      }))
      .sort((a, b) => b.specsAffected - a.specsAffected)
      .slice(0, MAX_OTHER_SUBRULES);
  }
  return out;
}

function findLatestRawForRepo(reportsDir: string, repo: string): string | null {
  const prefix = `raw-${repo}-`;
  const files = readdirSync(reportsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? join(reportsDir, files[0]) : null;
}

function main(): number {
  const args = process.argv.slice(2);
  let rawPath: string | null = null;
  let repo: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) {
      repo = args[++i];
    } else if (!args[i].startsWith('-')) {
      rawPath = args[i];
      break;
    }
  }

  if (!rawPath && repo) {
    const reportsDir = join(process.cwd(), 'scripts', 'corpus-data', 'reports');
    if (!existsSync(reportsDir)) {
      console.error(`Reports directory not found: ${reportsDir}`);
      return 1;
    }
    const found = findLatestRawForRepo(reportsDir, repo);
    if (!found) {
      console.error(`No raw-${repo}-*.json files found in ${reportsDir}`);
      return 1;
    }
    rawPath = found;
    console.log(`Using latest: ${rawPath}`);
  }

  if (!rawPath) {
    console.error('Usage: npm run corpus:report -- [--repo REPO] [path-to-raw-output.json]');
    console.error('  REPO: api-guru | github');
    console.error('Example: npm run corpus:report -- --repo api-guru');
    console.error(
      'Example: npm run corpus:report -- scripts/corpus-data/reports/raw-api-guru-2026-03-04T12-30-45.json'
    );
    return 1;
  }

  const absPath = rawPath.startsWith('/') ? rawPath : join(process.cwd(), rawPath);
  if (!existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    return 1;
  }

  let data: RawOutput;
  try {
    data = JSON.parse(readFileSync(absPath, 'utf-8'));
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
  const allErrorsWithPath = collectAllErrorsWithPath(results);
  const messageBreakdown = buildMessageBreakdown(allErrorsWithPath, 5);
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
    if (cost === 'trivial') trivialSpecs.add(r.path);
    else if (cost === 'medium') mediumSpecs.add(r.path);
    else hardSpecs.add(r.path);
  }
  const trivialPct = totalInvalidSpecs > 0 ? (trivialSpecs.size / totalInvalidSpecs) * 100 : 0;
  const mediumPct = totalInvalidSpecs > 0 ? (mediumSpecs.size / totalInvalidSpecs) * 100 : 0;
  const hardPct = totalInvalidSpecs > 0 ? (hardSpecs.size / totalInvalidSpecs) * 100 : 0;

  const easyFixRate = trivialPct; // "easy fix" = trivial
  const naturalFit = passRate + easyFixRate;

  const compileTimes = results.filter((r) => !r.parseFailed).map((r) => r.compileTimeMs);
  const avgCompileMs =
    compileTimes.length > 0 ? compileTimes.reduce((a, b) => a + b, 0) / compileTimes.length : 0;
  const maxCompileMs = compileTimes.length > 0 ? Math.max(...compileTimes) : 0;

  const resourceCounts = validResults.map((r) => r.resourceCount ?? 0).filter((n) => n > 0);
  const fieldCounts = validResults.map((r) => r.fieldCount ?? 0).filter((n) => n > 0);
  const totalResources = resourceCounts.reduce((a, b) => a + b, 0);
  const totalFields = fieldCounts.reduce((a, b) => a + b, 0);
  const avgResources =
    resourceCounts.length > 0
      ? resourceCounts.reduce((a, b) => a + b, 0) / resourceCounts.length
      : 0;
  const avgFieldsPerResource = totalResources > 0 ? totalFields / totalResources : 0;

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
  let crudListScoped = 0;
  let crudDetail = 0;
  let crudCreate = 0;
  let crudUpdate = 0;
  let crudDelete = 0;
  let crudResourceCount = 0;
  let groupingTag = 0;
  let groupingPath = 0;
  const specComplexityStats: Array<{
    resourcesPerSpec: number[];
    operationsPerResource: number[];
  }> = [];

  for (const { apiIr, strategy } of apiIrResults) {
    const shape = analyzeResourceShape(apiIr);
    mergedResourceShape.fieldsPerResource.push(...shape.fieldsPerResource);
    mergedResourceShape.requiredFields.push(...shape.requiredFields);
    mergedResourceShape.enumFields.push(...shape.enumFields);
    mergedResourceShape.arrayFields.push(...shape.arrayFields);
    mergedResourceShape.nestedDepth.push(...shape.nestedDepth);

    const crud = analyzeCrudPattern(apiIr);
    crudList += crud.list;
    crudListScoped += crud.listScoped;
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
    const v = item.openapiVersion ?? 'unknown';
    const prefix = v.startsWith('3.1') ? '3.1.x' : v.startsWith('3.0') ? '3.0.x' : 'other';
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

  const specLevelMetrics = buildSpecLevelMetrics(invalidResults, categorizeError);
  const roadmapCategories = Object.entries(specLevelMetrics)
    .sort((a, b) => b[1].rawInstances - a[1].rawInstances)
    .slice(0, 14);

  const subRuleMetrics = buildSubRuleMetrics(invalidResults, categorizeError);

  const reportDir = dirname(absPath);
  const rawBase = rawPath.split('/').pop() ?? rawPath;
  const reportBase = rawBase.replace(/^raw-/, 'report-').replace(/\.json$/, '.md');
  const reportPath = join(reportDir, reportBase);

  const lines: string[] = [];

  const isGitHubBatch =
    typeof meta.batch === 'string' && (meta.batch === 'github' || meta.batch.startsWith('github-'));
  const sourceLabel = isGitHubBatch ? 'GitHub' : 'APIs.guru (via openapi-directory)';

  lines.push('# RapidUI RUS-v1 Corpus Report');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Batch:** ${meta.batch}`);
  lines.push('');
  lines.push('## SAMPLING METHOD');
  lines.push('');
  lines.push(`Source: ${sourceLabel}`);
  lines.push(`Selection: Batch ${meta.batch}`);
  lines.push(`Total in batch: ${meta.sampleSize}`);
  lines.push(`Sample size: ${meta.sampleSize}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## SECTION 1: SPEC-LEVEL COMPATIBILITY');
  lines.push('');
  lines.push('_Product roadmap metric: which rules block the most specs?_');
  lines.push('');
  lines.push(`Total specs tested: ${total}`);
  lines.push(`Valid (RUS-v1 compliant): ${validCount}`);
  lines.push(`Pass rate: ${validCount}/${total} (${passRate.toFixed(1)}%)`);
  lines.push(
    `Near-pass (single violation): ${singleViolation.length} specs (${nearPassPct.toFixed(1)}%)`
  );
  lines.push(
    `Fix cost: Low ${trivialPct.toFixed(0)}% | Medium ${mediumPct.toFixed(0)}% | High ${hardPct.toFixed(0)}%`
  );
  lines.push(`Natural Fit Score: pass_rate + easy_fix_rate = ${naturalFit.toFixed(1)}%`);
  lines.push('');
  lines.push('### Roadmap Table (spec impact vs validator workload)');
  lines.push('');
  lines.push('| Rule | Specs affected | Near-pass | Only blocker | Raw instances | Top-10 % |');
  lines.push('|------|---------------:|---------:|-------------:|-------------:|---------:|');
  for (const [cat, m] of roadmapCategories) {
    const short = cat.length > 28 ? cat.slice(0, 25) + '…' : cat;
    lines.push(
      `| ${short} | ${m.uniqueSpecsAffected} | ${m.nearPassSpecs} | ${m.onlyBlockerSpecs} | ${m.rawInstances} | ${m.top10SpecConcentrationPct.toFixed(0)}% |`
    );
  }
  lines.push('');
  lines.push('**Interpretation:**');
  lines.push('- High raw + low specs affected = repetition (e.g. one giant spec, many ops)');
  lines.push('- High specs affected + high near-pass = strong relaxation candidate');
  lines.push('- High top-10 % = large-spec distortion; raw counts overstate impact');
  lines.push('');
  lines.push('### Near-pass analysis (single-failure reasons)');
  lines.push('');
  lines.push(`Specs that would pass if one rule were relaxed: ${singleViolation.length}`);
  lines.push('');
  for (const [cat, count] of topSingle) {
    const pct = singleViolation.length > 0 ? (count / singleViolation.length) * 100 : 0;
    lines.push(`- ${cat}: ${count} (${pct.toFixed(0)}%)`);
  }
  lines.push('');
  lines.push('### Only-blocker categories');
  lines.push('');
  const onlyBlockerSorted = roadmapCategories
    .filter(([, m]) => m.onlyBlockerSpecs > 0)
    .sort((a, b) => b[1].onlyBlockerSpecs - a[1].onlyBlockerSpecs)
    .slice(0, 8);
  if (onlyBlockerSorted.length > 0) {
    for (const [cat, m] of onlyBlockerSorted) {
      lines.push(
        `- ${cat}: ${m.onlyBlockerSpecs} specs would pass if this rule alone were relaxed`
      );
    }
  } else {
    lines.push('(No specs fail on a single category only)');
  }
  lines.push('');
  lines.push('### Sub-rule implementation order (top 3 categories)');
  lines.push('');
  lines.push('_Granular breakdown for coding decisions. Use for implementation sequencing._');
  lines.push('');
  for (const cat of TOP_CATEGORIES_FOR_SUBRULE) {
    const subRules = subRuleMetrics[cat];
    if (!subRules || subRules.length === 0) continue;
    lines.push(`#### ${cat}`);
    lines.push('');
    lines.push('| Sub-rule | Specs affected | Only blocker | Near-pass | Top-10 % |');
    lines.push('|----------|---------------:|-------------:|---------:|---------:|');
    for (const s of subRules) {
      const safe = s.subRule.replace(/\|/g, '\\|');
      const short = safe.length > 52 ? safe.slice(0, 49) + '…' : safe;
      lines.push(
        `| ${short} | ${s.specsAffected} | ${s.onlyBlocker} | ${s.nearPass} | ${s.top10Pct.toFixed(0)}% |`
      );
    }
    lines.push('');
  }
  const otherSubRules = subRuleMetrics[OTHER_BUCKET_CATEGORY];
  if (otherSubRules && otherSubRules.length > 0) {
    lines.push('### Other bucket breakdown');
    lines.push('');
    lines.push('| Sub-rule | Specs affected |');
    lines.push('|----------|---------------:|');
    for (const s of otherSubRules) {
      const safe = s.subRule.replace(/\|/g, '\\|');
      const short = safe.length > 72 ? safe.slice(0, 69) + '…' : safe;
      lines.push(`| ${short} | ${s.specsAffected} |`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## SECTION 2: INSTANCE-LEVEL REJECTION DENSITY');
  lines.push('');
  lines.push('_Validator workload: where does the validator spend its time failing?_');
  lines.push('');
  lines.push(
    '**Caveat:** Raw instance counts are biased toward large, repetitive specs. Do not use for roadmap prioritization. See Section 1.'
  );
  lines.push('');
  lines.push('### Rejection reasons (raw instance counts)');
  lines.push('');
  const totalErr = allErrors.length;
  for (const [cat, count] of topCategories) {
    const pct = totalErr > 0 ? (count / totalErr) * 100 : 0;
    lines.push(`- ${cat}: ${count} (${pct.toFixed(1)}%)`);
  }
  lines.push('');
  lines.push('### Top offending specs (by total errors)');
  lines.push('');
  const specErrorTotals = new Map<string, number>();
  for (const r of invalidResults) {
    const prev = specErrorTotals.get(r.path) ?? 0;
    specErrorTotals.set(r.path, prev + r.errors.length);
  }
  const topOffenders = [...specErrorTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [path, count] of topOffenders) {
    const short = path.split('/').pop() ?? path;
    lines.push(`- ${short}: ${count} errors`);
  }
  lines.push('');
  lines.push('### Failure location');
  lines.push('');
  const locEntries = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
  for (const [loc, count] of locEntries) {
    const pct = totalErr > 0 ? (count / totalErr) * 100 : 0;
    lines.push(`- ${loc}: ${count} (${pct.toFixed(1)}%)`);
  }
  lines.push('');
  lines.push('### Rejection glossary & per-message breakdown');
  lines.push('');
  lines.push('See `docs/subset-v1-rejection-glossary.md`. Per-message breakdown (instance-level):');
  lines.push('');
  const maxCategoriesForBreakdown = 8;
  const maxMessagesPerCategory = 15;
  for (let i = 0; i < Math.min(maxCategoriesForBreakdown, topCategories.length); i++) {
    const [cat] = topCategories[i];
    const breakdown = messageBreakdown[cat];
    if (!breakdown || breakdown.length === 0) continue;
    lines.push(`#### ${cat}`);
    lines.push('');
    const toShow = breakdown.slice(0, maxMessagesPerCategory);
    for (const { message, count: msgCount, pct: msgPct, examples } of toShow) {
      const shortMsg = message.length > 80 ? message.slice(0, 77) + '...' : message;
      lines.push(`- **${shortMsg}** — ${msgCount} (${msgPct.toFixed(1)}% of category)`);
      if (examples.length > 0) {
        const short = examples.slice(0, 3).map((p) => p.split('/').pop() ?? p);
        lines.push(`  - Examples: ${short.join(', ')}`);
      }
      lines.push('');
    }
    if (breakdown.length > maxMessagesPerCategory) {
      const rest = breakdown.length - maxMessagesPerCategory;
      lines.push(`- _... and ${rest} more message variants_`);
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('## SECTION 3: CORPUS SHAPE');
  lines.push('');
  lines.push('Schema reuse / ref graph: N/A (requires spec re-read)');
  lines.push('');
  lines.push('### Language analysis (passing specs)');
  lines.push('');
  lines.push('Resource shape, CRUD coverage, grouping strategy, spec complexity — from ApiIR.');
  lines.push('');
  if (apiIrResults.length > 0) {
    lines.push('#### Resource Shape Distribution');
    lines.push('');
    for (const line of formatResourceShapeReport(mergedResourceShape)) {
      lines.push(line);
    }
    lines.push('');
    lines.push('#### CRUD Pattern Distribution');
    lines.push('');
    for (const line of formatCrudPatternReport({
      list: crudList,
      listScoped: crudListScoped,
      detail: crudDetail,
      create: crudCreate,
      update: crudUpdate,
      delete: crudDelete,
      resourceCount: crudResourceCount,
    })) {
      lines.push(line);
    }
    lines.push('');
    lines.push('#### Resource Grouping Strategy');
    lines.push('');
    for (const line of formatGroupingStrategyReport(groupingTag, groupingPath)) {
      lines.push(line);
    }
    lines.push('');
    lines.push('#### Spec Complexity Distribution');
    lines.push('');
    for (const line of formatSpecComplexityReport(specComplexityStats)) {
      lines.push(line);
    }
  } else {
    lines.push('No passing specs — language analysis skipped.');
  }
  lines.push('');
  lines.push('### OpenAPI Version Distribution');
  lines.push('');
  const totalVer = Object.values(versionCounts).reduce((a, b) => a + b, 0);
  for (const [ver, count] of Object.entries(versionCounts).sort()) {
    const pct = totalVer > 0 ? (count / totalVer) * 100 : 0;
    lines.push(`- ${ver}: ${count} (${pct.toFixed(1)}%)`);
  }
  lines.push('');
  lines.push('### System health');
  lines.push('');
  lines.push('Determinism: Skipped for v1');
  lines.push(`Compile time: avg ${avgCompileMs.toFixed(0)} ms, max ${maxCompileMs} ms`);
  lines.push(`Compiler crashes: ${crashCount}`);
  lines.push(`Parse failures: ${parseFailCount} (excluded from crash count)`);
  lines.push('');
  lines.push('### IR Metrics (valid specs)');
  lines.push('');
  lines.push(`Average resources per API: ${avgResources.toFixed(1)}`);
  lines.push(`Average fields per resource: ${avgFieldsPerResource.toFixed(1)}`);
  lines.push('');
  lines.push('### RUS-v2 roadmap implications');
  lines.push('');
  lines.push(
    'Prioritize by **spec impact** (Section 1 roadmap table), not raw instance counts. Strong candidates: high near-pass + high only-blocker. Avoid: high raw + high top-10 % (large-spec distortion).'
  );
  lines.push('');
  lines.push('## EXAMPLES');
  lines.push('');
  if (validResults.length > 0) {
    lines.push('### Example PASS');
    const ex = validResults[0];
    lines.push(`- Path: ${ex.path}`);
    lines.push(`- Resources: ${ex.resourceCount ?? 'N/A'}`);
    lines.push('');
  }
  if (invalidResults.length > 0) {
    lines.push('### Example FAIL');
    const ex = invalidResults[0];
    lines.push(`- Path: ${ex.path}`);
    lines.push(`- Reason: ${ex.errors[0]?.message ?? 'unknown'}`);
    lines.push(`- Code: ${ex.errors[0]?.code ?? 'unknown'}`);
  }
  lines.push('');

  const reportContent = lines.join('\n');
  writeFileSync(reportPath, reportContent, 'utf-8');

  console.log(`Report written to: ${reportPath}`);
  return 0;
}

process.exit(main());
