/**
 * ApiIR types — semantic IR for OpenAPI → UISpec pipeline.
 * Pure semantic representation; no structure invention.
 */

/** JSON Schema object (OpenAPI schema subset). */
export type JsonSchema = Record<string, unknown>;

export interface ApiIR {
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

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type OperationKind = "list" | "detail" | "create" | "update" | "delete";

export interface OperationIR {
  /** Stable deterministic id (e.g. operationId or method:path). */
  id: string;
  method: HttpMethod;
  kind: OperationKind;
  path: string;
  /** Path param name for detail/update/delete (e.g. "userId", "sku"). */
  identifierParam?: string;
  requestSchema?: JsonSchema;
  responseSchema: JsonSchema;
}
