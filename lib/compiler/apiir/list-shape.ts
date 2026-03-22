/**
 * Shared list-shaped success-body classification for ApiIR build, lowering, mining, and reports.
 * Precedence: array root → list-shaped; object envelope → preferred keys + catch-all array property; else not list-shaped.
 */

import type { JsonSchema } from './types';

/** JSON Schema `type` keywords used by this module. */
export const JSON_SCHEMA_TYPE = {
  array: 'array',
  object: 'object',
} as const;

export type JsonSchemaTypeKeyword = (typeof JSON_SCHEMA_TYPE)[keyof typeof JSON_SCHEMA_TYPE];

/** Labels returned by {@link classifyListResponseEnvelope} (stable corpus / report tokens). */
export const LIST_ENVELOPE_LABEL = {
  other: 'other',
  object: 'object',
} as const;

function asRecord(schema: JsonSchema): Record<string, unknown> {
  return schema as Record<string, unknown>;
}

function envelopeObjectPath(...segments: string[]): string {
  return [LIST_ENVELOPE_LABEL.object, ...segments].join('.');
}

/** True when `type` is exactly or includes the JSON Schema primitive type (OpenAPI 3.1 unions). */
export function schemaHasJsonType(schema: JsonSchema, jsonType: JsonSchemaTypeKeyword): boolean {
  const ty = asRecord(schema).type;
  if (ty === jsonType) return true;
  if (Array.isArray(ty)) return (ty as unknown[]).includes(jsonType);
  return false;
}

/**
 * True when the schema is a JSON array with `items` (subset requires items for array types).
 */
export function isArrayRootSchema(schema: JsonSchema): boolean {
  if (!schema || typeof schema !== 'object') return false;
  if (!schemaHasJsonType(schema, JSON_SCHEMA_TYPE.array)) return false;
  const items = asRecord(schema).items;
  return items !== undefined && items !== null && typeof items === 'object';
}

/**
 * Known JSON property names for list envelope roots (single source for string values).
 * Iteration order for classification is {@link LIST_ENVELOPE_OUTER_KEY_ORDER}.
 */
export const LIST_ENVELOPE_OUTER_KEY = {
  data: 'data',
  items: 'items',
  results: 'results',
  records: 'records',
  response: 'response',
  payload: 'payload',
  body: 'body',
  entries: 'entries',
  list: 'list',
  values: 'values',
  content: 'content',
  elements: 'elements',
} as const;

/** Preferred outer keys in precedence order (stable report labels). */
export const LIST_ENVELOPE_OUTER_KEY_ORDER = [
  LIST_ENVELOPE_OUTER_KEY.data,
  LIST_ENVELOPE_OUTER_KEY.items,
  LIST_ENVELOPE_OUTER_KEY.results,
  LIST_ENVELOPE_OUTER_KEY.records,
  LIST_ENVELOPE_OUTER_KEY.response,
  LIST_ENVELOPE_OUTER_KEY.payload,
  LIST_ENVELOPE_OUTER_KEY.body,
  LIST_ENVELOPE_OUTER_KEY.entries,
  LIST_ENVELOPE_OUTER_KEY.list,
  LIST_ENVELOPE_OUTER_KEY.values,
  LIST_ENVELOPE_OUTER_KEY.content,
  LIST_ENVELOPE_OUTER_KEY.elements,
] as const;

/**
 * Known property names when scanning nested envelope objects (e.g. `response.items`).
 * Iteration order is {@link LIST_ENVELOPE_INNER_KEY_ORDER}.
 */
export const LIST_ENVELOPE_INNER_KEY = {
  data: 'data',
  items: 'items',
  results: 'results',
  records: 'records',
  values: 'values',
  elements: 'elements',
} as const;

export const LIST_ENVELOPE_INNER_KEY_ORDER = [
  LIST_ENVELOPE_INNER_KEY.data,
  LIST_ENVELOPE_INNER_KEY.items,
  LIST_ENVELOPE_INNER_KEY.results,
  LIST_ENVELOPE_INNER_KEY.records,
  LIST_ENVELOPE_INNER_KEY.values,
  LIST_ENVELOPE_INNER_KEY.elements,
] as const;

function isArraySubschema(obj: Record<string, unknown>): boolean {
  const t = obj.type;
  return (
    t === JSON_SCHEMA_TYPE.array ||
    (Array.isArray(t) && (t as unknown[]).includes(JSON_SCHEMA_TYPE.array))
  );
}

function findArrayPropertyKey(props: Record<string, unknown>): string | null {
  for (const [key, val] of Object.entries(props)) {
    if (val && typeof val === 'object' && isArraySubschema(val as Record<string, unknown>)) {
      return key;
    }
  }
  return null;
}

/**
 * Preferred-envelope + nested path only (no arbitrary property catch-all).
 * Used to decide list-shaped vs single-record bodies — avoids treating e.g. `tags: string[]` on a
 * detail object as a collection response.
 */
function classifyListEnvelopePreferred(schema: JsonSchema): string | null {
  const props = asRecord(schema).properties as Record<string, unknown> | undefined;
  if (!props || typeof props !== 'object') return null;

  for (const outer of LIST_ENVELOPE_OUTER_KEY_ORDER) {
    const val = props[outer];
    if (!val || typeof val !== 'object') continue;
    const obj = val as Record<string, unknown>;
    if (isArraySubschema(obj)) return envelopeObjectPath(outer);
    const innerProps = obj.properties as Record<string, unknown> | undefined;
    if (innerProps && typeof innerProps === 'object') {
      for (const inner of LIST_ENVELOPE_INNER_KEY_ORDER) {
        const innerVal = innerProps[inner];
        if (
          innerVal &&
          typeof innerVal === 'object' &&
          isArraySubschema(innerVal as Record<string, unknown>)
        ) {
          return envelopeObjectPath(outer, inner);
        }
      }
    }
  }
  return null;
}

/**
 * Classify object-root (or property-only) envelope list shapes for analytics.
 * Returns `"other"` when no list-shaped array is found under known heuristics.
 * Includes a catch-all array property for corpus histograms (not used for ApiIR kind).
 */
export function classifyListResponseEnvelope(schema: JsonSchema): string {
  const preferred = classifyListEnvelopePreferred(schema);
  if (preferred) return preferred;

  const props = asRecord(schema).properties as Record<string, unknown> | undefined;
  if (!props || typeof props !== 'object') return LIST_ENVELOPE_LABEL.other;

  const catchAll = findArrayPropertyKey(props);
  if (catchAll) return envelopeObjectPath(catchAll);
  return LIST_ENVELOPE_LABEL.other;
}

/**
 * True when a 200/201 JSON success body is list-shaped (tabular / collection data).
 * Used for GET with one path segment to choose {@link OPERATION_KIND.listScoped} vs detail.
 */
export function isListShapedResponseSchema(schema: JsonSchema): boolean {
  if (!schema || typeof schema !== 'object') return false;
  if (isArrayRootSchema(schema)) return true;
  return classifyListEnvelopePreferred(schema) !== null;
}
