/**
 * Schema-based seed generator.
 * Produces deterministic sample records from JSON Schema.
 * Same schema → same seeds. 3–5 records per resource.
 */

import type { JsonSchema } from "../apiir/types";
import { getObjectSchema } from "../lowering/schema-to-field";

const SEED_COUNT = 4;

/**
 * Generate sample records from list response schema.
 * Uses responseSchema from ApiIR (array with items).
 */
export function generateSeeds(
  responseSchema: JsonSchema,
  idField: string = "id"
): Record<string, unknown>[] {
  const objSchema = getObjectSchema(responseSchema);
  if (!objSchema) return [];

  const records: Record<string, unknown>[] = [];
  for (let i = 0; i < SEED_COUNT; i++) {
    const record = generateRecord(objSchema, idField, i);
    records.push(record);
  }
  return records;
}

function generateRecord(
  schema: JsonSchema,
  idField: string,
  index: number
): Record<string, unknown> {
  const props = schema.properties as Record<string, JsonSchema> | undefined;
  if (!props || typeof props !== "object") return {};

  const out: Record<string, unknown> = {};

  for (const [key, propSchema] of Object.entries(props)) {
    if (!propSchema || typeof propSchema !== "object") continue;
    const value = generateValue(propSchema, key === idField ? `seed-${index + 1}` : undefined, index);
    if (value !== undefined) {
      out[key] = value;
    }
  }

  return out;
}

function generateValue(
  schema: JsonSchema,
  idOverride?: string,
  index: number = 0
): unknown {
  if (idOverride !== undefined) return idOverride;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const idx = index % schema.enum.length;
    return schema.enum[idx];
  }

  const t = schema.type;
  const type = Array.isArray(t) ? t[0] : t;

  switch (type) {
    case "string":
      return `sample-${index + 1}`;
    case "integer":
    case "number":
      return index + 1;
    case "boolean":
      return index % 2 === 0;
    case "object": {
      const props = schema.properties as Record<string, JsonSchema> | undefined;
      if (!props || typeof props !== "object") return {};
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (!v || typeof v !== "object") continue;
        out[k] = generateValue(v, undefined, index);
      }
      return out;
    }
    case "array":
      return [];
    default:
      return `value-${index + 1}`;
  }
}
