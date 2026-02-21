/**
 * Map JSON Schema (from ApiIR) to UISpec Field info.
 * Extracts type, required, options for each path.
 * Excludes array-of-primitive fields (UISpec has no array type).
 */

import type { Field } from "@/lib/spec/types";
import type { JsonSchema } from "../apiir/types";

export type FieldType = "string" | "number" | "boolean" | "enum";

export interface FieldInfo {
  type: FieldType;
  required: boolean;
  options?: string[];
}

/**
 * Get the effective object schema. For list response (array), use items schema.
 */
export function getObjectSchema(schema: JsonSchema): JsonSchema | null {
  if (schema.type === "array") {
    const items = schema.items as JsonSchema | undefined;
    return items && typeof items === "object" ? items : null;
  }
  if (schema.type === "object") return schema;
  return null;
}

/**
 * Extract flat map of path -> FieldInfo from JSON Schema.
 * Nested objects are flattened: profile.firstName, profile.lastName.
 * Array-of-primitive fields are excluded.
 * For array schema (list response), uses items schema.
 */
export function extractSchemaFields(
  schema: JsonSchema,
  requiredAtRoot: string[] = []
): Map<string, FieldInfo> {
  const objSchema = getObjectSchema(schema);
  if (!objSchema) return new Map();

  const result = new Map<string, FieldInfo>();
  const props = objSchema.properties as Record<string, JsonSchema> | undefined;
  const required = (objSchema.required as string[] | undefined) ?? requiredAtRoot;

  if (!props || typeof props !== "object") return result;

  for (const [key, propSchema] of Object.entries(props)) {
    if (!propSchema || typeof propSchema !== "object") continue;
    collectFields(propSchema, key, new Set(required), result);
  }

  return result;
}

function collectFields(
  schema: JsonSchema,
  path: string,
  parentRequired: Set<string>,
  out: Map<string, FieldInfo>,
  currentKey?: string
): void {
  const key = currentKey ?? path.split(".").pop() ?? path;
  const isRequired = parentRequired.has(key);

  if (schema.type === "array") {
    const items = schema.items as JsonSchema | undefined;
    if (!items || typeof items !== "object") return;
    const itemType = items.type as string | undefined;
    if (itemType === "string" || itemType === "number" || itemType === "integer" || itemType === "boolean") {
      return; // Exclude array-of-primitive
    }
    if (itemType === "object") {
      const itemProps = items.properties as Record<string, JsonSchema> | undefined;
      const itemRequired = (items.required as string[] | undefined) ?? [];
      if (itemProps) {
        for (const [k, v] of Object.entries(itemProps)) {
          if (!v || typeof v !== "object") continue;
          collectFields(v, `${path}.${k}`, new Set(itemRequired), out, k);
        }
      }
    }
    return;
  }

  if (schema.type === "object") {
    const props = schema.properties as Record<string, JsonSchema> | undefined;
    const required = (schema.required as string[] | undefined) ?? [];
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (!v || typeof v !== "object") continue;
        collectFields(v, `${path}.${k}`, new Set(required), out, k);
      }
    }
    return;
  }

  const type = inferFieldType(schema);
  if (!type) return;

  const info: FieldInfo = {
    type,
    required: isRequired,
  };
  if (type === "enum" && Array.isArray(schema.enum)) {
    info.options = schema.enum.filter((v): v is string => typeof v === "string");
    if (info.options.length === 0) return;
  }

  out.set(path, info);
}

function inferFieldType(schema: JsonSchema): FieldType | null {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return "enum";
  const t = schema.type;
  if (Array.isArray(t)) {
    const first = t.find((x) => x === "string" || x === "number" || x === "integer" || x === "boolean");
    if (first === "integer") return "number";
    if (first) return first as FieldType;
    return null;
  }
  if (t === "integer") return "number";
  if (t === "string" || t === "number" || t === "boolean") return t as FieldType;
  return null;
}

/**
 * Build UISpec Field from FieldPlan + schema FieldInfo.
 * Uses FieldPlan for path, label, readOnly; schema for type, required, options.
 */
export function schemaToField(
  path: string,
  label: string | undefined,
  info: FieldInfo,
  readOnly?: boolean
): Field {
  const resolvedLabel = label && label.trim() ? label : pathToLabel(path);
  const field: Field = {
    name: path,
    label: resolvedLabel,
    type: info.type,
    required: info.required,
  };
  if (info.type === "enum" && info.options?.length) {
    field.options = info.options;
  }
  if (readOnly === true) {
    field.readOnly = true;
  }
  return field;
}

function pathToLabel(path: string): string {
  const last = path.split(".").pop() ?? path;
  return last.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}
