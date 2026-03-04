/**
 * OpenAPI canonicalizer.
 * Produces deterministic JSON: stable key ordering, stable array ordering,
 * strips ignored fields (description, example, summary).
 */

import stringify from "fast-json-stable-stringify";

const IGNORED_KEYS = new Set(["description", "example", "summary"]);
const SCHEMA_PRIMITIVE_TYPES = new Set(["string", "integer", "number", "boolean", "object", "array"]);

/** Normalize OAS 3.1 nullable union type: ["string","null"] → type: "string", nullable: true */
function normalizeNullableType(
  typeVal: unknown
): { type: unknown; nullable?: boolean } | null {
  if (!Array.isArray(typeVal) || typeVal.length !== 2) return null;
  if (!typeVal.includes("null")) return null;
  const prim = typeVal.find((x) => x !== "null" && SCHEMA_PRIMITIVE_TYPES.has(String(x)));
  if (!prim) return null;
  return { type: prim, nullable: true };
}

function stripIgnored(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (IGNORED_KEYS.has(k)) continue;
    if (k === "type") {
      const normalized = normalizeNullableType(v);
      if (normalized) {
        out["type"] = normalized.type;
        out["nullable"] = true;
      } else {
        out[k] = processValue(v);
      }
      continue;
    }
    out[k] = processValue(v);
  }
  return out;
}

function processValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return processArray(val);
  if (typeof val === "object") return stripIgnored(val as Record<string, unknown>);
  return val;
}

function processArray(arr: unknown[]): unknown[] {
  if (arr.length === 0) return arr;

  const first = arr[0];
  if (first !== null && typeof first === "object" && !Array.isArray(first)) {
    const obj = first as Record<string, unknown>;
    if ("name" in obj && typeof obj.name === "string") {
      return [...arr]
        .map((item) =>
          typeof item === "object" && item !== null
            ? stripIgnored(item as Record<string, unknown>)
            : item
        )
        .sort((a, b) => {
          const aName = (a as Record<string, unknown>)?.name;
          const bName = (b as Record<string, unknown>)?.name;
          return String(aName ?? "").localeCompare(String(bName ?? ""));
        });
    }
    if ("in" in obj && "name" in obj) {
      return [...arr]
        .map((item) =>
          typeof item === "object" && item !== null
            ? stripIgnored(item as Record<string, unknown>)
            : item
        )
        .sort((a, b) => {
          const aName = (a as Record<string, unknown>)?.name;
          const bName = (b as Record<string, unknown>)?.name;
          return String(aName ?? "").localeCompare(String(bName ?? ""));
        });
    }
  }

  if (arr.every((x) => typeof x === "string" || typeof x === "number")) {
    return [...arr].sort((a, b) => {
      const sa = String(a);
      const sb = String(b);
      return sa.localeCompare(sb, undefined, { numeric: true });
    });
  }

  return arr.map((item) => processValue(item));
}

function processObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (IGNORED_KEYS.has(k)) continue;
    if (k === "parameters" && Array.isArray(v)) {
      out[k] = processArray(v);
      continue;
    }
    if (k === "required" && Array.isArray(v)) {
      out[k] = processArray(v);
      continue;
    }
    if (k === "enum" && Array.isArray(v)) {
      // Preserve enum order (UI-significant; do not sort)
      out[k] = (v as unknown[]).map((item) => processValue(item));
      continue;
    }
    out[k] = processValue(v);
  }
  return out;
}

function canonicalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return processArray(val);
  if (typeof val === "object") return processObject(val as Record<string, unknown>);
  return val;
}

/**
 * Canonicalize OpenAPI document for deterministic output.
 * - Strips description, example, summary
 * - Normalizes nullable: type: ["string","null"] → type: "string", nullable: true
 * - Sorts parameters by name, required by value; preserves enum order (UI-significant)
 * - Uses stable key ordering (via fast-json-stable-stringify for final output)
 */
export function canonicalize(doc: Record<string, unknown>): Record<string, unknown> {
  return canonicalizeValue(doc) as Record<string, unknown>;
}

/**
 * Produce deterministic JSON string from canonical document.
 */
export function canonicalStringify(doc: Record<string, unknown>): string {
  const canonical = canonicalize(doc);
  return stringify(canonical);
}
