/**
 * ApiIR language analysis — compute stats from ApiIR for corpus reports.
 * Used only on passing specs to answer: What is the real language of APIs?
 */

import type { ApiIR, OperationIR, JsonSchema, ResourceIR } from "@/lib/compiler/apiir";
import type { GroupingStrategy } from "@/lib/compiler/apiir/grouping";

const KIND_ORDER: OperationIR["kind"][] = ["list", "detail", "create", "update", "delete"];

export interface ResourceShapeStats {
  fieldsPerResource: number[];
  requiredFields: number[];
  enumFields: number[];
  arrayFields: number[];
  nestedDepth: number[];
}

export interface CrudPatternStats {
  list: number;
  detail: number;
  create: number;
  update: number;
  delete: number;
  resourceCount: number;
}

export interface GroupingStrategyStats {
  tag: number;
  path: number;
}

export interface SpecComplexityStats {
  resourcesPerSpec: number[];
  operationsPerResource: number[];
}

function getObjectSchema(schema: JsonSchema): Record<string, unknown> | null {
  const s = schema as Record<string, unknown>;
  if (s.type === "object" || (Array.isArray(s.type) && (s.type as unknown[]).includes("object"))) {
    const props = s.properties;
    return props && typeof props === "object" ? (props as Record<string, unknown>) : null;
  }
  if (s.type === "array" || (Array.isArray(s.type) && (s.type as unknown[]).includes("array"))) {
    const items = s.items;
    if (items && typeof items === "object") {
      return getObjectSchema(items as JsonSchema);
    }
  }
  return null;
}

function countEnumFields(props: Record<string, unknown>): number {
  let count = 0;
  for (const v of Object.values(props)) {
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if ("enum" in obj && Array.isArray(obj.enum)) count++;
    }
  }
  return count;
}

function countArrayFields(props: Record<string, unknown>): number {
  let count = 0;
  for (const v of Object.values(props)) {
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const t = obj.type;
      if (t === "array" || (Array.isArray(t) && (t as unknown[]).includes("array"))) count++;
    }
  }
  return count;
}

function schemaDepth(schema: JsonSchema, current = 0): number {
  const s = schema as Record<string, unknown>;
  const props = s.properties;
  if (!props || typeof props !== "object") return current;
  let max = current;
  for (const v of Object.values(props)) {
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const t = obj.type;
      if (t === "object" || (Array.isArray(t) && (t as unknown[]).includes("object"))) {
        max = Math.max(max, schemaDepth(obj as JsonSchema, current + 1));
      }
      if (t === "array" || (Array.isArray(t) && (t as unknown[]).includes("array"))) {
        const items = obj.items;
        if (items && typeof items === "object") {
          max = Math.max(max, schemaDepth(items as JsonSchema, current + 1));
        }
      }
    }
  }
  return max;
}

function countNestedObjects(props: Record<string, unknown>): number {
  let count = 0;
  for (const v of Object.values(props)) {
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const t = obj.type;
      if (t === "object" || (Array.isArray(t) && (t as unknown[]).includes("object"))) count++;
    }
  }
  return count;
}

function hasIdField(props: Record<string, unknown>): boolean {
  const idPattern = /^(id|_id|.*Id|.*_id)$/i;
  for (const name of Object.keys(props)) {
    if (idPattern.test(name)) return true;
  }
  return false;
}

export interface ResourceSignature {
  fields: number;
  has_id: boolean;
  enums: number;
  arrays: number;
  nested_objects: number;
  depth: number;
  query_params: number;
  operations: OperationIR["kind"][];
}

export function analyzeResourceShape(apiIr: ApiIR): ResourceShapeStats {
  const fieldsPerResource: number[] = [];
  const requiredFields: number[] = [];
  const enumFields: number[] = [];
  const arrayFields: number[] = [];
  const nestedDepth: number[] = [];

  for (const res of apiIr.resources) {
    let fields = 0;
    let required = 0;
    let enums = 0;
    let arrays = 0;
    let depth = 0;

    for (const op of res.operations) {
      const schema = op.responseSchema as Record<string, unknown>;
      const obj = getObjectSchema(schema as JsonSchema);
      if (obj) {
        const keys = Object.keys(obj);
        if (keys.length > fields) fields = keys.length;
        const req = schema.required as string[] | undefined;
        if (Array.isArray(req) && req.length > required) required = req.length;
        const e = countEnumFields(obj);
        if (e > enums) enums = e;
        const a = countArrayFields(obj);
        if (a > arrays) arrays = a;
        const d = schemaDepth(schema as JsonSchema);
        if (d > depth) depth = d;
      }
    }
    if (fields > 0) {
      fieldsPerResource.push(fields);
      requiredFields.push(required);
      enumFields.push(enums);
      arrayFields.push(arrays);
      nestedDepth.push(depth);
    }
  }

  return {
    fieldsPerResource,
    requiredFields,
    enumFields,
    arrayFields,
    nestedDepth,
  };
}

export function analyzeCrudPattern(apiIr: ApiIR): CrudPatternStats {
  const kinds = new Set<OperationIR["kind"]>();
  for (const res of apiIr.resources) {
    for (const op of res.operations) {
      kinds.add(op.kind);
    }
  }
  let list = 0;
  let detail = 0;
  let create = 0;
  let update = 0;
  let del = 0;
  for (const res of apiIr.resources) {
    const opKinds = new Set(res.operations.map((o) => o.kind));
    if (opKinds.has("list")) list++;
    if (opKinds.has("detail")) detail++;
    if (opKinds.has("create")) create++;
    if (opKinds.has("update")) update++;
    if (opKinds.has("delete")) del++;
  }
  return {
    list,
    detail,
    create,
    update,
    delete: del,
    resourceCount: apiIr.resources.length,
  };
}

export function analyzeGroupingStrategy(strategy: GroupingStrategy): GroupingStrategyStats {
  return strategy === "tag" ? { tag: 1, path: 0 } : { tag: 0, path: 1 };
}

export function analyzeSpecComplexity(apiIr: ApiIR): SpecComplexityStats {
  const resourcesPerSpec = [apiIr.resources.length];
  const operationsPerResource = apiIr.resources.map((r) => r.operations.length);
  return { resourcesPerSpec, operationsPerResource };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function formatResourceShapeReport(stats: ResourceShapeStats): string[] {
  const lines: string[] = [];
  const all = stats.fieldsPerResource.length;
  if (all === 0) return ["No resources with object schemas analyzed."];

  const sort = (a: number[]) => [...a].sort((x, y) => x - y);

  const fields = sort(stats.fieldsPerResource);
  const required = sort(stats.requiredFields);
  const enums = sort(stats.enumFields);
  const arrays = sort(stats.arrayFields);
  const depth = sort(stats.nestedDepth);

  lines.push(`Resources analyzed: ${all}`);
  lines.push("");
  lines.push("Fields per resource:");
  lines.push(`  median: ${median(fields)}`);
  lines.push(`  p90: ${percentile(fields, 90)}`);
  lines.push(`  max: ${fields[fields.length - 1] ?? 0}`);
  lines.push("");
  lines.push("Required fields:");
  lines.push(`  median: ${median(required)}`);
  lines.push(`  p90: ${percentile(required, 90)}`);
  lines.push(`  max: ${required[required.length - 1] ?? 0}`);
  lines.push("");
  lines.push("Enum fields:");
  lines.push(`  median: ${median(enums)}`);
  lines.push(`  p90: ${percentile(enums, 90)}`);
  lines.push(`  max: ${enums[enums.length - 1] ?? 0}`);
  lines.push("");
  lines.push("Array fields:");
  lines.push(`  median: ${median(arrays)}`);
  lines.push(`  p90: ${percentile(arrays, 90)}`);
  lines.push(`  max: ${arrays[arrays.length - 1] ?? 0}`);
  lines.push("");
  lines.push("Schema depth:");
  lines.push(`  median: ${median(depth)}`);
  lines.push(`  p90: ${percentile(depth, 90)}`);
  lines.push(`  max: ${depth[depth.length - 1] ?? 0}`);

  return lines;
}

export function formatCrudPatternReport(stats: CrudPatternStats): string[] {
  const lines: string[] = [];
  const n = stats.resourceCount;
  if (n === 0) return ["No resources analyzed."];

  const pct = (x: number) => ((x / n) * 100).toFixed(0);
  lines.push("CRUD Pattern Coverage");
  lines.push("");
  lines.push(`list:     ${pct(stats.list)}%`);
  lines.push(`detail:   ${pct(stats.detail)}%`);
  lines.push(`create:   ${pct(stats.create)}%`);
  lines.push(`update:   ${pct(stats.update)}%`);
  lines.push(`delete:   ${pct(stats.delete)}%`);

  return lines;
}

export function formatGroupingStrategyReport(
  tagCount: number,
  pathCount: number
): string[] {
  const lines: string[] = [];
  const total = tagCount + pathCount;
  if (total === 0) return ["No specs analyzed."];

  const pct = (x: number) => ((x / total) * 100).toFixed(0);
  lines.push("Grouping strategy");
  lines.push("");
  lines.push(`tag-based:   ${pct(tagCount)}%`);
  lines.push(`path-based:  ${pct(pathCount)}%`);

  return lines;
}

export function extractResourceSignature(res: ResourceIR): ResourceSignature | null {
  if (res.operations.length === 0) return null;

  let fields = 0;
  let has_id = false;
  let enums = 0;
  let arrays = 0;
  let nested_objects = 0;
  let depth = 0;
  let query_params = 0;

  for (const op of res.operations) {
    const obj = getObjectSchema(op.responseSchema);
    if (obj) {
      const keys = Object.keys(obj);
      if (keys.length > fields) fields = keys.length;
      if (!has_id && hasIdField(obj)) has_id = true;
      const e = countEnumFields(obj);
      if (e > enums) enums = e;
      const a = countArrayFields(obj);
      if (a > arrays) arrays = a;
      const n = countNestedObjects(obj);
      if (n > nested_objects) nested_objects = n;
      const d = schemaDepth(op.responseSchema);
      if (d > depth) depth = d;
    }
    const q = op.queryParamCount ?? 0;
    if (q > query_params) query_params = q;
  }

  const opKinds = [...new Set(res.operations.map((o) => o.kind))].sort(
    (a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)
  );

  return {
    fields,
    has_id,
    enums,
    arrays,
    nested_objects,
    depth,
    query_params,
    operations: opKinds,
  };
}

function bucketFields(n: number): string {
  if (n <= 4) return "fields≤4";
  if (n <= 6) return "fields≤6";
  if (n <= 8) return "fields≤8";
  if (n <= 10) return "fields≤10";
  if (n <= 12) return "fields≤12";
  return "fields>12";
}

function bucketDepth(d: number): string {
  if (d === 0) return "depth0";
  if (d === 1) return "depth1";
  if (d === 2) return "depth2";
  return "depth3+";
}

/** Normalize signature to canonical bucketed pattern string for report. */
export function normalizePattern(sig: ResourceSignature): string {
  const fieldsBucket = bucketFields(sig.fields);
  const depthBucket = bucketDepth(sig.depth);
  const opsStr = sig.operations.join("+");
  return `${fieldsBucket} ${depthBucket} ops:${opsStr}`;
}

export interface PatternMiningEntry {
  apiIr: ApiIR;
  specPath?: string;
}

export interface PatternMiningResult {
  pattern: string;
  count: number;
  share: number;
  examples: string[];
}

export function mineStructuralPatterns(
  entries: PatternMiningEntry[]
): { results: PatternMiningResult[]; totalResources: number } {
  const patternMap = new Map<string, { count: number; examples: string[] }>();
  let totalResources = 0;

  for (const { apiIr, specPath } of entries) {
    const specId = specPath
      ? specPath.split("/").pop()?.replace(/\.(json|yaml|yml)$/, "").replace(/__openapi$/, "") ?? "unknown"
      : "unknown";

    for (const res of apiIr.resources) {
      const sig = extractResourceSignature(res);
      if (!sig) continue;
      if (sig.fields === 0 && sig.operations.length === 0) continue;

      const pattern = normalizePattern(sig);
      totalResources++;

      const existing = patternMap.get(pattern);
      const examples = existing?.examples ?? [];
      const example = `${specId}/${res.key}`;
      if (examples.length < 3 && !examples.includes(example)) {
        examples.push(example);
      }

      patternMap.set(pattern, {
        count: (existing?.count ?? 0) + 1,
        examples,
      });
    }
  }

  const results: PatternMiningResult[] = [];
  for (const [pattern, { count, examples }] of patternMap.entries()) {
    results.push({
      pattern,
      count,
      share: totalResources > 0 ? (count / totalResources) * 100 : 0,
      examples,
    });
  }
  results.sort((a, b) => b.count - a.count);

  return { results, totalResources };
}

export function formatPatternMiningReport(
  results: PatternMiningResult[],
  totalResources: number
): string[] {
  const lines: string[] = [];
  lines.push("#### Structural Pattern Distribution");
  lines.push("");
  lines.push("Top Resource Patterns");
  lines.push("");

  if (results.length === 0 || totalResources === 0) {
    lines.push("No resources with object schemas analyzed.");
    return lines;
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const pct = Math.round(r.share);
    lines.push(`${i + 1}. ${r.pattern}`);
    lines.push(`   ${r.count} resources (${pct}%)`);
    if (r.examples.length > 0) {
      lines.push(`   examples: ${r.examples.join(", ")}`);
    }
    lines.push("");
  }

  return lines;
}

export function formatSpecComplexityReport(stats: SpecComplexityStats[]): string[] {
  const lines: string[] = [];
  const allResources: number[] = [];
  const allOps: number[] = [];
  for (const s of stats) {
    allResources.push(...s.resourcesPerSpec);
    allOps.push(...s.operationsPerResource);
  }
  if (allResources.length === 0 && allOps.length === 0) {
    return ["No specs analyzed."];
  }

  const sort = (a: number[]) => [...a].sort((x, y) => x - y);
  const resSorted = sort(allResources);
  const opsSorted = sort(allOps);

  const median = (a: number[]) =>
    a.length === 0 ? 0 : a.length % 2 ? a[Math.floor(a.length / 2)]! : (a[a.length / 2 - 1]! + a[a.length / 2]!) / 2;
  const p90 = (a: number[]) =>
    a.length === 0 ? 0 : a[Math.ceil(0.9 * a.length) - 1] ?? 0;

  lines.push("Spec complexity");
  lines.push("");
  lines.push("resources per spec:");
  lines.push(`  median: ${median(resSorted)}`);
  lines.push(`  p90: ${p90(resSorted)}`);
  lines.push("");
  lines.push("operations per resource:");
  lines.push(`  median: ${median(opsSorted)}`);
  lines.push(`  p90: ${p90(opsSorted)}`);

  return lines;
}
