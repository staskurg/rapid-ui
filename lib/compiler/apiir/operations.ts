/**
 * Map OpenAPI operations to OperationIR.
 * CRUD only: list, detail, create, update, delete.
 * Non-CRUD → compile error.
 */

import type { CompilerError } from "../errors";
import { createError } from "../errors";
import type { OperationIR, JsonSchema } from "./types";
import type { RawOperation } from "./grouping";

const SUCCESS_CODES = ["200", "201"];

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

function getSuccessSchema(
  op: Record<string, unknown>,
  doc: Record<string, unknown>
): JsonSchema | null {
  const responses = op.responses as Record<string, unknown> | undefined;
  if (!responses || typeof responses !== "object") return null;
  for (const code of SUCCESS_CODES) {
    const resp = responses[code];
    if (!resp || typeof resp !== "object") continue;
    const content = (resp as Record<string, unknown>).content as
      | Record<string, unknown>
      | undefined;
    if (!content || typeof content !== "object") continue;
    const jsonContent = content["application/json"];
    if (!jsonContent || typeof jsonContent !== "object") continue;
    const schema = (jsonContent as Record<string, unknown>).schema;
    if (!schema || typeof schema !== "object") continue;
    return schema as JsonSchema;
  }
  return null;
}

function getRequestSchema(
  op: Record<string, unknown>,
  doc: Record<string, unknown>
): JsonSchema | null {
  const body = op.requestBody as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") return null;
  const content = body.content as Record<string, unknown> | undefined;
  if (!content || typeof content !== "object") return null;
  const jsonContent = content["application/json"];
  if (!jsonContent || typeof jsonContent !== "object") return null;
  const schema = (jsonContent as Record<string, unknown>).schema;
  if (!schema || typeof schema !== "object") return null;
  return schema as JsonSchema;
}

function inferKind(
  method: string,
  path: string,
  pathParams: string[]
): { kind: OperationIR["kind"]; identifierParam?: string } | null {
  const m = method.toLowerCase();
  if (m === "get") {
    if (pathParams.length === 0) return { kind: "list" };
    if (pathParams.length === 1) return { kind: "detail", identifierParam: pathParams[0] };
    return null;
  }
  if (m === "post") {
    if (pathParams.length === 0) return { kind: "create" };
    return null;
  }
  if (m === "put" || m === "patch") {
    if (pathParams.length === 1) return { kind: "update", identifierParam: pathParams[0] };
    return null;
  }
  if (m === "delete") {
    if (pathParams.length === 1) return { kind: "delete", identifierParam: pathParams[0] };
    return null;
  }
  return null;
}

function stableOperationId(method: string, path: string, operationId?: string): string {
  if (operationId && typeof operationId === "string" && operationId.trim()) {
    return operationId.trim();
  }
  return `${method.toUpperCase()}:${path}`;
}

export interface MapOperationResult {
  success: true;
  operation: OperationIR;
}

export interface MapOperationFailure {
  success: false;
  error: CompilerError;
}

export type MapOperationOutput = MapOperationResult | MapOperationFailure;

/**
 * Map a raw operation to OperationIR.
 * Requires doc with resolved refs for schema lookup.
 */
export function mapOperation(
  raw: RawOperation,
  doc: Record<string, unknown>
): MapOperationOutput {
  const pathParams = extractPathParams(raw.path);
  const kindResult = inferKind(raw.method, raw.path, pathParams);
  if (!kindResult) {
    return {
      success: false,
      error: createError(
        "IR_INVALID",
        "ApiIR",
        `Non-CRUD operation: ${raw.method.toUpperCase()} ${raw.path} (path params: ${pathParams.join(", ") || "none"})`,
        `/paths/${raw.path.replace(/\//g, "~1")}/${raw.method}`
      ),
    };
  }

  const pathItem = (doc.paths as Record<string, unknown>)?.[raw.path];
  if (!pathItem || typeof pathItem !== "object") {
    return {
      success: false,
      error: createError(
        "IR_INVALID",
        "ApiIR",
        `Path not found: ${raw.path}`,
        `/paths/${raw.path.replace(/\//g, "~1")}`
      ),
    };
  }
  const opObj = (pathItem as Record<string, unknown>)[raw.method];
  if (!opObj || typeof opObj !== "object") {
    return {
      success: false,
      error: createError(
        "IR_INVALID",
        "ApiIR",
        `Operation not found: ${raw.method} ${raw.path}`,
        `/paths/${raw.path.replace(/\//g, "~1")}/${raw.method}`
      ),
    };
  }
  const op = opObj as Record<string, unknown>;

  const responseSchema = getSuccessSchema(op, doc);
  if (!responseSchema) {
    return {
      success: false,
      error: createError(
        "IR_INVALID",
        "ApiIR",
        `No 200/201 application/json response: ${raw.method.toUpperCase()} ${raw.path}`,
        `/paths/${raw.path.replace(/\//g, "~1")}/${raw.method}`
      ),
    };
  }

  let requestSchema: JsonSchema | undefined;
  if (kindResult.kind === "create" || kindResult.kind === "update") {
    const req = getRequestSchema(op, doc);
    if (!req) {
      return {
        success: false,
        error: createError(
        "IR_INVALID",
        "ApiIR",
          `${raw.method.toUpperCase()} requires requestBody`,
          `/paths/${raw.path.replace(/\//g, "~1")}/${raw.method}`
        ),
      };
    }
    requestSchema = req;
  }

  const id = stableOperationId(raw.method, raw.path, raw.operationId);
  const method = raw.method.toUpperCase() as OperationIR["method"];

  return {
    success: true,
    operation: {
      id,
      method,
      kind: kindResult.kind,
      path: raw.path,
      ...(kindResult.identifierParam && { identifierParam: kindResult.identifierParam }),
      ...(requestSchema && { requestSchema }),
      responseSchema,
    },
  };
}
