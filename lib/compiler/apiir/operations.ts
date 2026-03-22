/**
 * Map OpenAPI operations to OperationIR.
 * CRUD only: list, detail, create, update, delete.
 * Non-CRUD → compile error.
 * Content negotiation: select application/json when present (multiple content types allowed).
 */

import type { CompilerError } from '../errors';
import { createError } from '../errors';
import {
  OPERATION_KIND,
  PARAMETER_IN,
  type OperationIR,
  type JsonSchema,
  type ParameterIR,
} from './types';
import type { RawOperation } from './grouping';
import { selectJsonContent } from '../openapi/content';
import { isListShapedResponseSchema } from './list-shape';

const SUCCESS_CODES = ['200', '201'];

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

function getSuccessSchema(
  op: Record<string, unknown>,
  _doc: Record<string, unknown>
): JsonSchema | null {
  const responses = op.responses as Record<string, unknown> | undefined;
  if (!responses || typeof responses !== 'object') return null;
  for (const code of SUCCESS_CODES) {
    const resp = responses[code];
    if (!resp || typeof resp !== 'object') continue;
    const content = (resp as Record<string, unknown>).content as
      | Record<string, unknown>
      | undefined;
    const selected = selectJsonContent(content);
    if (selected) return selected.schema as JsonSchema;
  }
  return null;
}

function getRequestSchema(
  op: Record<string, unknown>,
  _doc: Record<string, unknown>
): JsonSchema | null {
  const body = op.requestBody as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') return null;
  const content = body.content as Record<string, unknown> | undefined;
  const selected = selectJsonContent(content);
  return selected ? (selected.schema as JsonSchema) : null;
}

function inferCrudKind(
  method: string,
  pathParams: string[],
  responseSchema: JsonSchema
): { kind: OperationIR['kind']; identifierParam?: string } | null {
  const m = method.toLowerCase();
  if (m === 'get') {
    if (pathParams.length === 0) return { kind: OPERATION_KIND.list };
    if (pathParams.length === 1) {
      if (isListShapedResponseSchema(responseSchema)) {
        return { kind: OPERATION_KIND.listScoped, identifierParam: pathParams[0] };
      }
      return { kind: OPERATION_KIND.detail, identifierParam: pathParams[0] };
    }
    return null;
  }
  if (m === 'post') {
    if (pathParams.length === 0) return { kind: OPERATION_KIND.create };
    return null;
  }
  if (m === 'put' || m === 'patch') {
    if (pathParams.length === 1)
      return { kind: OPERATION_KIND.update, identifierParam: pathParams[0] };
    return null;
  }
  if (m === 'delete') {
    if (pathParams.length === 1)
      return { kind: OPERATION_KIND.delete, identifierParam: pathParams[0] };
    return null;
  }
  return null;
}

function stableOperationId(method: string, path: string, operationId?: string): string {
  if (operationId && typeof operationId === 'string' && operationId.trim()) {
    return operationId.trim();
  }
  return `${method.toUpperCase()}:${path}`;
}

const paramKey = (p: Record<string, unknown>) => `${String(p.in ?? '')}:${String(p.name ?? '')}`;

function toParameterIR(raw: Record<string, unknown>): ParameterIR | null {
  const loc = raw.in;
  if (loc !== PARAMETER_IN.path && loc !== PARAMETER_IN.query) return null;
  const name = String(raw.name ?? '');
  const schema = raw.schema;
  if (!schema || typeof schema !== 'object') return null;
  const sch = schema as Record<string, unknown>;
  const format = typeof sch.format === 'string' ? sch.format : undefined;
  const isQuery = loc === PARAMETER_IN.query;
  const queryRequired = isQuery && raw.required === true;
  return {
    in: loc,
    name,
    schema: schema as JsonSchema,
    ...(format !== undefined ? { format } : {}),
    ...(queryRequired ? { required: true as const } : {}),
  };
}

/**
 * Merge path-level and op-level parameters (op wins by `in:name`), then sort path before query, then name.
 */
function mergeParameters(
  pathItem: Record<string, unknown>,
  op: Record<string, unknown>
): ParameterIR[] {
  const merged = new Map<string, Record<string, unknown>>();
  const pathLevelParams = pathItem.parameters as Record<string, unknown>[] | undefined;
  const opParams = op.parameters as Record<string, unknown>[] | undefined;
  if (pathLevelParams && Array.isArray(pathLevelParams)) {
    for (const p of pathLevelParams) {
      if (p && typeof p === 'object')
        merged.set(paramKey(p as Record<string, unknown>), p as Record<string, unknown>);
    }
  }
  if (opParams && Array.isArray(opParams)) {
    for (const p of opParams) {
      if (p && typeof p === 'object')
        merged.set(paramKey(p as Record<string, unknown>), p as Record<string, unknown>);
    }
  }
  const list: ParameterIR[] = [];
  for (const raw of merged.values()) {
    const ir = toParameterIR(raw);
    if (ir) list.push(ir);
  }
  list.sort((a, b) => {
    const ai = a.in === PARAMETER_IN.path ? 0 : 1;
    const bi = b.in === PARAMETER_IN.path ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  return list;
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
export function mapOperation(raw: RawOperation, doc: Record<string, unknown>): MapOperationOutput {
  const pathParams = extractPathParams(raw.path);

  const pathItem = (doc.paths as Record<string, unknown>)?.[raw.path];
  if (!pathItem || typeof pathItem !== 'object') {
    return {
      success: false,
      error: createError(
        'IR_INVALID',
        'ApiIR',
        `Path not found: ${raw.path}`,
        `/paths/${raw.path.replace(/\//g, '~1')}`
      ),
    };
  }
  const opObj = (pathItem as Record<string, unknown>)[raw.method];
  if (!opObj || typeof opObj !== 'object') {
    return {
      success: false,
      error: createError(
        'IR_INVALID',
        'ApiIR',
        `Operation not found: ${raw.method} ${raw.path}`,
        `/paths/${raw.path.replace(/\//g, '~1')}/${raw.method}`
      ),
    };
  }
  const op = opObj as Record<string, unknown>;

  const responseSchema = getSuccessSchema(op, doc);
  if (!responseSchema) {
    return {
      success: false,
      error: createError(
        'IR_INVALID',
        'ApiIR',
        `No 200/201 application/json response: ${raw.method.toUpperCase()} ${raw.path}`,
        `/paths/${raw.path.replace(/\//g, '~1')}/${raw.method}`
      ),
    };
  }

  const kindResult = inferCrudKind(raw.method, pathParams, responseSchema);
  if (!kindResult) {
    return {
      success: false,
      error: createError(
        'IR_INVALID',
        'ApiIR',
        `Non-CRUD operation: ${raw.method.toUpperCase()} ${raw.path} (path params: ${pathParams.join(', ') || 'none'})`,
        `/paths/${raw.path.replace(/\//g, '~1')}/${raw.method}`
      ),
    };
  }

  let requestSchema: JsonSchema | undefined;
  if (kindResult.kind === OPERATION_KIND.create || kindResult.kind === OPERATION_KIND.update) {
    const req = getRequestSchema(op, doc);
    if (!req) {
      return {
        success: false,
        error: createError(
          'IR_INVALID',
          'ApiIR',
          `${raw.method.toUpperCase()} requires requestBody`,
          `/paths/${raw.path.replace(/\//g, '~1')}/${raw.method}`
        ),
      };
    }
    requestSchema = req;
  }

  const id = stableOperationId(raw.method, raw.path, raw.operationId);
  const method = raw.method.toUpperCase() as OperationIR['method'];
  const parameters = mergeParameters(pathItem as Record<string, unknown>, op);
  const queryParamCount = parameters.filter((p) => p.in === PARAMETER_IN.query).length;

  return {
    success: true,
    operation: {
      id,
      method,
      kind: kindResult.kind,
      path: raw.path,
      parameters,
      ...(kindResult.identifierParam && { identifierParam: kindResult.identifierParam }),
      ...(queryParamCount > 0 && { queryParamCount }),
      ...(requestSchema && { requestSchema }),
      responseSchema,
    },
  };
}
