/**
 * ApiIR types — semantic IR for OpenAPI → UISpec pipeline.
 * Pure semantic representation; no structure invention.
 */

/** Bump when serialized ApiIR JSON meaning or field set changes (see ARCHITECTURE.md). */
export const CURRENT_API_IR_VERSION = 1;

/** JSON Schema object (OpenAPI schema subset). */
export type JsonSchema = Record<string, unknown>;

/** Canonical operation kind literals — use these instead of raw strings. */
export const OPERATION_KIND = {
  list: 'list',
  listScoped: 'listScoped',
  detail: 'detail',
  create: 'create',
  update: 'update',
  delete: 'delete',
} as const;

export type OperationKind = (typeof OPERATION_KIND)[keyof typeof OPERATION_KIND];

/**
 * Sort order for operations within a resource (build + signature ordering).
 * list → listScoped → detail → mutations.
 */
export const OPERATION_KIND_ORDER = [
  OPERATION_KIND.list,
  OPERATION_KIND.listScoped,
  OPERATION_KIND.detail,
  OPERATION_KIND.create,
  OPERATION_KIND.update,
  OPERATION_KIND.delete,
] as const satisfies readonly OperationKind[];

/**
 * Monotonic rank for {@link OperationKind} (0 … n-1), aligned with {@link OPERATION_KIND_ORDER}.
 * Unknown kinds (e.g. legacy JSON) sort after all known kinds.
 */
export function operationKindRank(kind: OperationKind): number {
  const i = OPERATION_KIND_ORDER.indexOf(kind);
  if (i !== -1) return i;
  return OPERATION_KIND_ORDER.length;
}

/**
 * Stable ordering for operations / signature kind lists (build + mining).
 */
export function compareOperationKind(a: OperationKind, b: OperationKind): number {
  return operationKindRank(a) - operationKindRank(b);
}

/**
 * Report table order for “operation frequency” sections (differs from {@link OPERATION_KIND_ORDER}).
 */
export const OPERATION_KIND_REPORT_ORDER = [
  OPERATION_KIND.create,
  OPERATION_KIND.list,
  OPERATION_KIND.listScoped,
  OPERATION_KIND.detail,
  OPERATION_KIND.update,
  OPERATION_KIND.delete,
] as const satisfies readonly OperationKind[];

export const HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;

export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];

/** OpenAPI parameter `in` for IR (subset: path + query only). */
export const PARAMETER_IN = {
  path: 'path',
  query: 'query',
} as const;

export type ParameterIn = (typeof PARAMETER_IN)[keyof typeof PARAMETER_IN];

/**
 * Path or query parameter on an operation. Aligned with subset-validator: only `path` and `query`
 * are supported; `format` is echoed when present on the parameter schema.
 */
export interface ParameterIR {
  in: ParameterIn;
  name: string;
  schema: JsonSchema;
  /** OpenAPI `format` when present on the parameter schema (subset allowlist). */
  format?: string;
}

export interface ApiIR {
  /**
   * Monotonic contract version. Omitted on legacy persisted rows (readers treat as 0; see ARCHITECTURE.md).
   * The compiler always sets {@link CURRENT_API_IR_VERSION} on fresh builds.
   */
  apiIrVersion?: number;
  api: {
    title: string;
    version: string;
  };
  resources: ResourceIR[];
}

export interface ResourceIR {
  /** Display name (e.g. "Users", "Products"). */
  name: string;
  /** Grouping key / slug for URLs (e.g. "users", "products"). */
  key: string;
  operations: OperationIR[];
}

export interface OperationIR {
  /** Stable deterministic id (e.g. operationId or method:path). */
  id: string;
  method: HttpMethod;
  kind: OperationKind;
  path: string;
  /** Path param name for detail/update/delete, or scope id for listScoped — never row id for listScoped. */
  identifierParam?: string;
  /**
   * Path- and query-level parameters merged like the OpenAPI subset (op overrides path by `in:name`).
   * Sole authority for query inputs; sorted path before query, then name. Omitted on legacy snapshots;
   * treat as `[]` when absent.
   */
  parameters?: ParameterIR[];
  /** Count of `in: "query"` entries in `parameters`; omit when zero to keep JSON small. */
  queryParamCount?: number;
  requestSchema?: JsonSchema;
  responseSchema: JsonSchema;
}

/** True for operations whose success body supplies list-shaped / tabular data (see ARCHITECTURE.md). */
export function isListLikeKind(kind: OperationKind): boolean {
  return kind === OPERATION_KIND.list || kind === OPERATION_KIND.listScoped;
}
