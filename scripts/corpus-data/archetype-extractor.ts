/**
 * Archetype Extraction Tool — types, constants, and schema helpers.
 * Standalone module; no imports from analyze-apiir.ts.
 */

import {
  OPERATION_KIND,
  primaryListLikeOperation,
  type JsonSchema,
  type OperationKind,
  type OperationIR,
  type ResourceIR,
} from "@/lib/compiler/apiir";

// --- Archetype constants ---

export const ARCHETYPES = {
  SIMPLE_CREATE: "simple_create",
  SIMPLE_LIST: "simple_list",
  LIST_DETAIL: "list_detail",
  LIST_CREATE: "list_create",
  FULL_CRUD: "full_crud",
  ENUM_HEAVY: "enum_heavy",
  ARRAY_OF_OBJECTS: "array_of_objects",
  NESTED_DEPTH_1: "nested_depth_1",
  NESTED_DEPTH_2: "nested_depth_2",
  MAP_SCHEMA: "map_schema",
  MULTI_RESOURCE: "multi_resource",
  LARGE_RESOURCE: "large_resource",
  OPTIONAL_HEAVY: "optional_heavy",
  ARRAY_HEAVY: "array_heavy",
  MIXED_OPERATIONS: "mixed_operations",
  DEEP_SCHEMA: "deep_schema",
  MANY_ENUM_VALUES: "many_enum_values",
  NULLABLE_FIELDS: "nullable_fields",
  LARGE_API: "large_api",
  MIXED_SCHEMA_TYPES: "mixed_schema_types",
  ARRAY_ROOT_LIST: "array_root_list",
  WRAPPED_LIST_RESPONSE: "wrapped_list_response",
} as const;

export const ARCHETYPE_ORDER: readonly string[] = [
  ARCHETYPES.SIMPLE_CREATE,
  ARCHETYPES.SIMPLE_LIST,
  ARCHETYPES.LIST_DETAIL,
  ARCHETYPES.LIST_CREATE,
  ARCHETYPES.FULL_CRUD,
  ARCHETYPES.ENUM_HEAVY,
  ARCHETYPES.ARRAY_OF_OBJECTS,
  ARCHETYPES.NESTED_DEPTH_1,
  ARCHETYPES.NESTED_DEPTH_2,
  ARCHETYPES.MAP_SCHEMA,
  ARCHETYPES.MULTI_RESOURCE,
  ARCHETYPES.LARGE_RESOURCE,
  ARCHETYPES.OPTIONAL_HEAVY,
  ARCHETYPES.ARRAY_HEAVY,
  ARCHETYPES.MIXED_OPERATIONS,
  ARCHETYPES.DEEP_SCHEMA,
  ARCHETYPES.MANY_ENUM_VALUES,
  ARCHETYPES.NULLABLE_FIELDS,
  ARCHETYPES.LARGE_API,
  ARCHETYPES.MIXED_SCHEMA_TYPES,
  ARCHETYPES.ARRAY_ROOT_LIST,
  ARCHETYPES.WRAPPED_LIST_RESPONSE,
];

// Freeze to prevent mutation
Object.freeze(ARCHETYPES);
Object.freeze(ARCHETYPE_ORDER);

// --- Types ---

/** High-level CRUD shape derived from operation kinds (corpus / archetype tooling). */
export const OPERATION_PATTERN = {
  CREATE_ONLY: "create_only",
  LIST_ONLY: "list_only",
  DETAIL_ONLY: "detail_only",
  LIST_CREATE: "list_create",
  LIST_DETAIL: "list_detail",
  LIST_DETAIL_CREATE: "list_detail_create",
  CRUD: "crud",
  OTHER: "other",
} as const;

export type OperationPattern = (typeof OPERATION_PATTERN)[keyof typeof OPERATION_PATTERN];

export interface ResourceArchetypeMetrics {
  fieldCount: number;
  requiredCount: number;
  optionalCount: number;
  enumCount: number;
  arrayCount: number;
  arrayOfObjectsCount: number;
  arrayOfPrimitivesCount: number;
  mapCount: number;
  nullableCount: number;
  nestedObjectCount: number;
  maxDepth: number;
  maxEnumValues: number;
  operations: OperationKind[];
  operationCount: number;
  operationPattern: OperationPattern;
  listResponseShape: "array_root" | "object_wrapped" | "unknown";
  primitiveOnly: boolean;
}

export interface SpecArchetypeMetrics {
  resourceCount: number;
  operationCount: number;
  maxFieldsPerResource: number;
  maxDepth: number;
  maxArrayOfObjects: number;
}

// --- Schema helpers ---

/**
 * Extract object schema from JsonSchema.
 * - Returns schema for `type: "object"`
 * - Returns items schema for `type: "array"` when `items.type === "object"`
 * - Returns null for primitives, array of primitives, etc.
 */
export function getObjectSchema(schema: JsonSchema): JsonSchema | null {
  if (schema.type === "object") return schema;
  if (schema.type === "array") {
    const items = schema.items as JsonSchema | undefined;
    if (items && typeof items === "object" && items.type === "object") {
      return items;
    }
  }
  return null;
}

// --- Operation pattern ---

/**
 * Derive operation pattern from operation kinds using boolean checks only.
 * Order of checks matters; each pattern is mutually exclusive.
 * {@link OPERATION_KIND.list} and {@link OPERATION_KIND.listScoped} both count as list-like
 * (e.g. LIST_ONLY, LIST_DETAIL, CRUD).
 */
export function deriveOperationPattern(operations: OperationIR[]): OperationPattern {
  const kinds = new Set(operations.map((o) => o.kind));
  const hasList = kinds.has(OPERATION_KIND.list) || kinds.has(OPERATION_KIND.listScoped);
  const hasDetail = kinds.has(OPERATION_KIND.detail);
  const hasCreate = kinds.has(OPERATION_KIND.create);
  const hasUpdate = kinds.has(OPERATION_KIND.update);
  const hasDelete = kinds.has(OPERATION_KIND.delete);

  if (hasCreate && !hasList && !hasDetail && !hasUpdate && !hasDelete)
    return OPERATION_PATTERN.CREATE_ONLY;
  if (hasList && !hasCreate && !hasDetail && !hasUpdate && !hasDelete)
    return OPERATION_PATTERN.LIST_ONLY;
  if (hasDetail && !hasList && !hasCreate && !hasUpdate && !hasDelete)
    return OPERATION_PATTERN.DETAIL_ONLY;
  if (hasList && hasCreate && !hasDetail && !hasUpdate && !hasDelete)
    return OPERATION_PATTERN.LIST_CREATE;
  if (hasList && hasDetail && !hasCreate && !hasUpdate && !hasDelete)
    return OPERATION_PATTERN.LIST_DETAIL;
  if (hasList && hasDetail && hasCreate && !hasUpdate && !hasDelete)
    return OPERATION_PATTERN.LIST_DETAIL_CREATE;
  if (hasList && hasDetail && hasCreate && hasUpdate && hasDelete) return OPERATION_PATTERN.CRUD;
  return OPERATION_PATTERN.OTHER;
}

// --- Schema metrics (internal) ---

/** Resolve type from schema; handles type as string or array (e.g. ["string","null"]). */
function getSchemaType(schema: JsonSchema): string | undefined {
  const t = schema.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.find((x) => x !== "null") as string | undefined;
  return undefined;
}

/** Check if schema is nullable (nullable: true or type includes "null"). */
function isNullable(schema: JsonSchema): boolean {
  if (schema.nullable === true) return true;
  const t = schema.type;
  if (Array.isArray(t) && t.includes("null")) return true;
  return false;
}

/** Check if schema has additionalProperties (map). */
function hasAdditionalProperties(schema: JsonSchema): boolean {
  const ap = schema.additionalProperties;
  return ap === true || (typeof ap === "object" && ap !== null);
}

/**
 * Depth calculation — maximum object nesting depth.
 * - depth 0 = flat (no nested objects)
 * - object → depth +1
 * - array(object) → depth +1
 * - array(primitive) → depth +0
 * - map(object) (additionalProperties: object) → depth +1
 * - map(primitive) → depth +0
 * Example: User { address { city } } → depth = 1 (one nested object level)
 * Example: User { address { country { code } } } → depth = 2
 */
function schemaDepth(schema: JsonSchema): number {
  const props = schema.properties as Record<string, JsonSchema> | undefined;
  if (!props || typeof props !== "object") return 0;

  let maxChildDepth = 0;
  for (const v of Object.values(props)) {
    if (!v || typeof v !== "object") continue;
    const sub = v as JsonSchema;
    const type = getSchemaType(sub);

    if (type === "object") {
      maxChildDepth = Math.max(maxChildDepth, 1 + schemaDepth(sub));
    }
    if (type === "array") {
      const items = sub.items as JsonSchema | undefined;
      if (items && typeof items === "object") {
        const itemType = getSchemaType(items);
        if (itemType === "object") {
          maxChildDepth = Math.max(maxChildDepth, 1 + schemaDepth(items));
        }
        // array(primitive) → +0
      }
    }
    if (hasAdditionalProperties(sub)) {
      const ap = sub.additionalProperties as JsonSchema | undefined;
      if (ap && typeof ap === "object" && getSchemaType(ap) === "object") {
        maxChildDepth = Math.max(maxChildDepth, 1 + schemaDepth(ap));
      }
      // map(primitive) → +0
    }
  }
  return maxChildDepth;
}

interface SchemaCounts {
  fieldCount: number;
  requiredCount: number;
  optionalCount: number;
  enumCount: number;
  arrayCount: number;
  arrayOfObjectsCount: number;
  arrayOfPrimitivesCount: number;
  mapCount: number;
  nullableCount: number;
  nestedObjectCount: number;
  maxDepth: number;
  maxEnumValues: number;
}

function countSchema(schema: JsonSchema): SchemaCounts {
  const obj = getObjectSchema(schema);
  if (!obj) {
    return {
      fieldCount: 0,
      requiredCount: 0,
      optionalCount: 0,
      enumCount: 0,
      arrayCount: 0,
      arrayOfObjectsCount: 0,
      arrayOfPrimitivesCount: 0,
      mapCount: 0,
      nullableCount: 0,
      nestedObjectCount: 0,
      maxDepth: 0,
      maxEnumValues: 0,
    };
  }

  const props = obj.properties as Record<string, JsonSchema> | undefined;
  const required = new Set((obj.required as string[] | undefined) ?? []);
  if (!props || typeof props !== "object") {
    const mapCount = hasAdditionalProperties(obj) ? 1 : 0;
    return {
      fieldCount: 0,
      requiredCount: 0,
      optionalCount: 0,
      enumCount: 0,
      arrayCount: 0,
      arrayOfObjectsCount: 0,
      arrayOfPrimitivesCount: 0,
      mapCount,
      nullableCount: 0,
      nestedObjectCount: 0,
      maxDepth: 0,
      maxEnumValues: 0,
    };
  }

  let enumCount = 0;
  let arrayCount = 0;
  let arrayOfObjectsCount = 0;
  let arrayOfPrimitivesCount = 0;
  let mapCount = 0;
  let nullableCount = 0;
  let nestedObjectCount = 0;
  let maxEnumValues = 0;

  for (const [, prop] of Object.entries(props)) {
    if (!prop || typeof prop !== "object") continue;

    if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      enumCount++;
      maxEnumValues = Math.max(maxEnumValues, prop.enum.length);
    }
    if (isNullable(prop)) nullableCount++;

    const type = getSchemaType(prop);
    if (type === "object") nestedObjectCount++;
    if (type === "array") {
      arrayCount++;
      const items = prop.items as JsonSchema | undefined;
      if (items && typeof items === "object") {
        const itemType = getSchemaType(items);
        if (itemType === "object") arrayOfObjectsCount++;
        else arrayOfPrimitivesCount++;
      } else {
        arrayOfPrimitivesCount++;
      }
    }
    if (hasAdditionalProperties(prop)) mapCount++;
  }

  const fieldCount = Object.keys(props).length;
  const requiredCount = [...required].filter((k) => k in props).length;
  const optionalCount = fieldCount - requiredCount;
  const maxDepth = schemaDepth(obj);

  return {
    fieldCount,
    requiredCount,
    optionalCount,
    enumCount,
    arrayCount,
    arrayOfObjectsCount,
    arrayOfPrimitivesCount,
    mapCount,
    nullableCount,
    nestedObjectCount,
    maxDepth,
    maxEnumValues,
  };
}

function mergeCounts(a: SchemaCounts, b: SchemaCounts): SchemaCounts {
  return {
    fieldCount: Math.max(a.fieldCount, b.fieldCount),
    requiredCount: Math.max(a.requiredCount, b.requiredCount),
    optionalCount: Math.max(a.optionalCount, b.optionalCount),
    enumCount: Math.max(a.enumCount, b.enumCount),
    arrayCount: Math.max(a.arrayCount, b.arrayCount),
    arrayOfObjectsCount: Math.max(a.arrayOfObjectsCount, b.arrayOfObjectsCount),
    arrayOfPrimitivesCount: Math.max(a.arrayOfPrimitivesCount, b.arrayOfPrimitivesCount),
    mapCount: Math.max(a.mapCount, b.mapCount),
    nullableCount: Math.max(a.nullableCount, b.nullableCount),
    nestedObjectCount: Math.max(a.nestedObjectCount, b.nestedObjectCount),
    maxDepth: Math.max(a.maxDepth, b.maxDepth),
    maxEnumValues: Math.max(a.maxEnumValues, b.maxEnumValues),
  };
}

function getListResponseShape(responseSchema: JsonSchema | undefined): "array_root" | "object_wrapped" | "unknown" {
  if (!responseSchema || typeof responseSchema !== "object") return "unknown";

  const type = getSchemaType(responseSchema);
  if (type === "array") return "array_root";

  if (type === "object") {
    const props = responseSchema.properties as Record<string, JsonSchema> | undefined;
    if (props && typeof props === "object") {
      for (const v of Object.values(props)) {
        if (!v || typeof v !== "object") continue;
        const sub = v as JsonSchema;
        if (getSchemaType(sub) === "array") {
          const items = sub.items as JsonSchema | undefined;
          if (items && typeof items === "object" && getSchemaType(items) === "object") {
            return "object_wrapped";
          }
        }
      }
    }
  }
  return "unknown";
}

// --- Public API ---

/**
 * Extract resource-level archetype metrics from a ResourceIR.
 * Merges schema metrics from all operations (list response, create/update request, detail response).
 */
export function extractResourceMetrics(resource: ResourceIR): ResourceArchetypeMetrics {
  const operations = resource.operations;
  const kinds = operations.map((o) => o.kind);
  const operationCount = operations.length;

  let counts: SchemaCounts = {
    fieldCount: 0,
    requiredCount: 0,
    optionalCount: 0,
    enumCount: 0,
    arrayCount: 0,
    arrayOfObjectsCount: 0,
    arrayOfPrimitivesCount: 0,
    mapCount: 0,
    nullableCount: 0,
    nestedObjectCount: 0,
    maxDepth: 0,
    maxEnumValues: 0,
  };

  /** Collect all object schemas that describe the resource (for merging metrics). */
  function collectResourceSchemas(schema: JsonSchema): JsonSchema[] {
    const out: JsonSchema[] = [];
    const obj = getObjectSchema(schema);
    if (obj) out.push(obj);
    // object_wrapped: { data: [{ id, name }] } — resource shape is in array items
    if (getSchemaType(schema) === "object") {
      const props = schema.properties as Record<string, JsonSchema> | undefined;
      if (props) {
        for (const v of Object.values(props)) {
          if (!v || typeof v !== "object") continue;
          const sub = v as JsonSchema;
          if (getSchemaType(sub) === "array") {
            const items = sub.items as JsonSchema | undefined;
            if (items && typeof items === "object" && getSchemaType(items) === "object") {
              out.push(items);
            }
          }
        }
      }
    }
    return out;
  }

  for (const op of operations) {
    const schemas: JsonSchema[] = [];
    if (op.responseSchema) schemas.push(op.responseSchema);
    if (op.requestSchema) schemas.push(op.requestSchema);

    for (const schema of schemas) {
      for (const objSchema of collectResourceSchemas(schema)) {
        counts = mergeCounts(counts, countSchema(objSchema));
      }
    }
  }

  const listOp = primaryListLikeOperation(operations);
  const listResponseShape = getListResponseShape(listOp?.responseSchema);

  const primitiveOnly =
    counts.nestedObjectCount === 0 && counts.arrayCount === 0 && counts.mapCount === 0;

  return {
    ...counts,
    operations: kinds,
    operationCount,
    operationPattern: deriveOperationPattern(operations),
    listResponseShape,
    primitiveOnly,
  };
}

// --- Pass 1 aggregation ---

/**
 * Aggregate resource metrics into spec-level metrics.
 * Used in Pass 1; do not recompute in Pass 2.
 */
export function aggregateSpecMetrics(
  resourceMetrics: ResourceArchetypeMetrics[]
): SpecArchetypeMetrics {
  const resourceCount = resourceMetrics.length;
  const operationCount = resourceMetrics.reduce((sum, r) => sum + r.operationCount, 0);
  const maxFieldsPerResource =
    resourceMetrics.length > 0
      ? Math.max(...resourceMetrics.map((r) => r.fieldCount))
      : 0;
  const maxDepth =
    resourceMetrics.length > 0 ? Math.max(...resourceMetrics.map((r) => r.maxDepth)) : 0;
  const maxArrayOfObjects =
    resourceMetrics.length > 0
      ? Math.max(...resourceMetrics.map((r) => r.arrayOfObjectsCount))
      : 0;

  return {
    resourceCount,
    operationCount,
    maxFieldsPerResource,
    maxDepth,
    maxArrayOfObjects,
  };
}

/**
 * Spec complexity score (lower = simpler, preferred for golden candidates).
 * Uses spec aggregates from Pass 1.
 */
export function computeSpecComplexityScore(spec: SpecArchetypeMetrics): number {
  return (
    spec.resourceCount * 5 +
    spec.operationCount * 1 +
    spec.maxDepth * 10 +
    spec.maxFieldsPerResource * 2 +
    spec.maxArrayOfObjects * 3
  );
}

// --- Pass 2 classification ---

/**
 * Classify a resource into archetypes (resource-level only).
 * Returns all matching archetype IDs in ARCHETYPE_ORDER.
 */
export function classifyResourceArchetypes(
  resourceMetrics: ResourceArchetypeMetrics,
  specMetrics: SpecArchetypeMetrics
): string[] {
  void specMetrics; // Reserved for future spec-influenced resource rules
  const out: string[] = [];
  const r = resourceMetrics;

  // 1. simple_create: fields ≤ 4, depth = 0, create_only
  if (r.fieldCount <= 4 && r.maxDepth === 0 && r.operationPattern === OPERATION_PATTERN.CREATE_ONLY) {
    out.push(ARCHETYPES.SIMPLE_CREATE);
  }
  // 2. simple_list: fields ≤ 4, depth = 0, list_only
  if (r.fieldCount <= 4 && r.maxDepth === 0 && r.operationPattern === OPERATION_PATTERN.LIST_ONLY) {
    out.push(ARCHETYPES.SIMPLE_LIST);
  }
  // 3. list_detail: fields ≤ 4, depth = 0, list_detail
  if (r.fieldCount <= 4 && r.maxDepth === 0 && r.operationPattern === OPERATION_PATTERN.LIST_DETAIL) {
    out.push(ARCHETYPES.LIST_DETAIL);
  }
  // 4. list_create: fields ≤ 4, depth = 0, list_create
  if (r.fieldCount <= 4 && r.maxDepth === 0 && r.operationPattern === OPERATION_PATTERN.LIST_CREATE) {
    out.push(ARCHETYPES.LIST_CREATE);
  }
  // 5. full_crud: fields ≤ 6, depth = 0, crud
  if (r.fieldCount <= 6 && r.maxDepth === 0 && r.operationPattern === OPERATION_PATTERN.CRUD) {
    out.push(ARCHETYPES.FULL_CRUD);
  }
  // 6. enum_heavy: enumCount ≥ 2
  if (r.enumCount >= 2) {
    out.push(ARCHETYPES.ENUM_HEAVY);
  }
  // 7. array_of_objects: arrayOfObjectsCount ≥ 1
  if (r.arrayOfObjectsCount >= 1) {
    out.push(ARCHETYPES.ARRAY_OF_OBJECTS);
  }
  // 8. nested_depth_1: depth = 1
  if (r.maxDepth === 1) {
    out.push(ARCHETYPES.NESTED_DEPTH_1);
  }
  // 9. nested_depth_2: depth = 2
  if (r.maxDepth === 2) {
    out.push(ARCHETYPES.NESTED_DEPTH_2);
  }
  // 10. map_schema: mapCount ≥ 1
  if (r.mapCount >= 1) {
    out.push(ARCHETYPES.MAP_SCHEMA);
  }
  // 11. multi_resource: spec-level (handled in classifySpecArchetypes)
  // 12. large_resource: fieldCount ≥ 15
  if (r.fieldCount >= 15) {
    out.push(ARCHETYPES.LARGE_RESOURCE);
  }
  // 13. optional_heavy: required ≤ 2, optional ≥ 5
  if (r.requiredCount <= 2 && r.optionalCount >= 5) {
    out.push(ARCHETYPES.OPTIONAL_HEAVY);
  }
  // 14. array_heavy: arrayOfObjectsCount ≥ 2
  if (r.arrayOfObjectsCount >= 2) {
    out.push(ARCHETYPES.ARRAY_HEAVY);
  }
  // 15. mixed_operations: spec-level (handled in classifySpecArchetypes)
  // 16. deep_schema: depth ≥ 3
  if (r.maxDepth >= 3) {
    out.push(ARCHETYPES.DEEP_SCHEMA);
  }
  // 17. many_enum_values: maxEnumValues ≥ 10
  if (r.maxEnumValues >= 10) {
    out.push(ARCHETYPES.MANY_ENUM_VALUES);
  }
  // 18. nullable_fields: nullableCount ≥ 2
  if (r.nullableCount >= 2) {
    out.push(ARCHETYPES.NULLABLE_FIELDS);
  }
  // 19. large_api: spec-level (handled in classifySpecArchetypes)
  // 20. mixed_schema_types: enumCount ≥ 1 AND arrayOfObjectsCount ≥ 1 AND nestedObjectCount ≥ 1
  if (
    r.enumCount >= 1 &&
    r.arrayOfObjectsCount >= 1 &&
    r.nestedObjectCount >= 1
  ) {
    out.push(ARCHETYPES.MIXED_SCHEMA_TYPES);
  }
  // 21. array_root_list: listResponseShape = array_root
  if (r.listResponseShape === "array_root") {
    out.push(ARCHETYPES.ARRAY_ROOT_LIST);
  }
  // 22. wrapped_list_response: listResponseShape = object_wrapped
  if (r.listResponseShape === "object_wrapped") {
    out.push(ARCHETYPES.WRAPPED_LIST_RESPONSE);
  }

  return out;
}

/**
 * Classify a spec into archetypes (spec-level only).
 * Returns multi_resource, mixed_operations, large_api.
 */
export function classifySpecArchetypes(
  specMetrics: SpecArchetypeMetrics,
  resourceMetrics: ResourceArchetypeMetrics[]
): string[] {
  const out: string[] = [];
  const s = specMetrics;

  // 11. multi_resource: resourceCount ≥ 3
  if (s.resourceCount >= 3) {
    out.push(ARCHETYPES.MULTI_RESOURCE);
  }
  // 15. mixed_operations: spec has ≥1 create_only AND ≥1 list_only AND ≥1 detail_only
  const hasCreateOnly = resourceMetrics.some((r) => r.operationPattern === OPERATION_PATTERN.CREATE_ONLY);
  const hasListOnly = resourceMetrics.some((r) => r.operationPattern === OPERATION_PATTERN.LIST_ONLY);
  const hasDetailOnly = resourceMetrics.some((r) => r.operationPattern === OPERATION_PATTERN.DETAIL_ONLY);
  if (hasCreateOnly && hasListOnly && hasDetailOnly) {
    out.push(ARCHETYPES.MIXED_OPERATIONS);
  }
  // 19. large_api: resourceCount ≥ 10
  if (s.resourceCount >= 10) {
    out.push(ARCHETYPES.LARGE_API);
  }

  return out;
}
