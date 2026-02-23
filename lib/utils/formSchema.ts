/**
 * Form schema utilities for FormModal.
 *
 * React Hook Form stores values in a nested structure when using register("profile.firstName").
 * The UISpec uses flat dot-path names (e.g. "profile.firstName"). These helpers align
 * schema, validation, defaults, and error display with RHF's nested structure.
 *
 * @see docs/form-modal-nested-schema.md
 */

import { z } from "zod";
import type { UISpec, Field } from "@/lib/spec/types";

/**
 * Build a nested Zod schema from UISpec form fields.
 * Converts dotted paths (e.g. "profile.firstName") into nested object structure
 * that matches React Hook Form's output when using register("profile.firstName").
 *
 * @example
 * // spec.form.fields = ["email", "profile.firstName", "profile.lastName"]
 * // Produces: z.object({ email: z.string(), profile: z.object({ firstName: z.string(), lastName: z.string() }) })
 */
export function buildNestedSchema(
  spec: UISpec
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const rawShape: Record<string, unknown> = {};

  for (const fieldName of spec.form.fields) {
    const field = spec.fields.find((f) => f.name === fieldName);
    if (!field) continue;

    const fieldSchema = buildFieldSchema(field);

    if (fieldName.includes(".")) {
      const parts = fieldName.split(".");
      const leafKey = parts.pop()!;
      let current: Record<string, unknown> = rawShape;
      for (const part of parts) {
        if (!(part in current) || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
      current[leafKey] = fieldSchema;
    } else {
      rawShape[fieldName] = fieldSchema;
    }
  }

  return toZodObject(rawShape) as z.ZodObject<Record<string, z.ZodTypeAny>>;
}

function buildFieldSchema(field: Field): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (field.type) {
    case "string":
      schema = z.string();
      break;
    case "number":
      schema = z.number();
      break;
    case "boolean":
      if (field.required) {
        schema = z.boolean();
      } else {
        schema = z.preprocess(
          (val) => (val === undefined || val === null ? false : val),
          z.boolean()
        );
      }
      break;
    case "enum":
      schema = z.enum((field.options || []) as [string, ...string[]]);
      break;
    default:
      schema = z.string();
  }
  if (!field.required && field.type !== "boolean") {
    schema = schema.optional();
  }
  return schema;
}

function toZodObject(
  obj: Record<string, unknown>
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof z.ZodType) {
      shape[k] = v;
    } else if (
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      !(v instanceof Date)
    ) {
      shape[k] = toZodObject(v as Record<string, unknown>);
    }
  }
  return z.object(shape);
}

/**
 * Get form error message by dot path from nested errors object.
 * React Hook Form's formState.errors is nested when using nested schema.
 *
 * @example
 * getErrorByPath(errors, "profile.firstName") // errors?.profile?.firstName?.message
 */
export function getErrorByPath(
  errors: Record<string, unknown> | undefined,
  path: string
): { message?: string } | undefined {
  if (!errors) return undefined;
  const parts = path.split(".");
  let current: unknown = errors;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (current && typeof current === "object" && "message" in current) {
    return current as { message?: string };
  }
  return undefined;
}

/**
 * Set a value at a dot path in an object, creating nested structure as needed.
 * Used for building nested default values (e.g. profile.newsletter -> false).
 *
 * @example
 * setNested({}, "profile.newsletter", false) // { profile: { newsletter: false } }
 */
export function setNested(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  const leafKey = parts.pop()!;
  let current: Record<string, unknown> = obj;
  for (const part of parts) {
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[leafKey] = value;
}

/**
 * Build nested default values for optional boolean fields.
 * RHF expects nested structure for dot-path fields.
 */
export function buildNestedDefaults(spec: UISpec): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const fieldName of spec.form.fields) {
    const field = spec.fields.find((f) => f.name === fieldName);
    if (field && field.type === "boolean" && !field.required) {
      setNested(defaults, fieldName, false);
    }
  }
  return defaults;
}

function isPlainObject(
  v: unknown
): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    !(v instanceof Date)
  );
}

/**
 * Deep merge two objects. Values from `b` override `a`. Used to merge
 * nested defaults with initialValues so optional booleans are filled when
 * the API omits them.
 */
export function mergeNested(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const aVal = result[key];
    if (isPlainObject(value) && isPlainObject(aVal)) {
      result[key] = mergeNested(aVal, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
