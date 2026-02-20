/**
 * OpenAPI canonicalizer.
 * Produces deterministic JSON: stable key ordering, stable array ordering,
 * strips ignored fields (description, example, summary).
 */

import stringify from "fast-json-stable-stringify";

const IGNORED_KEYS = new Set(["description", "example", "summary"]);

function stripIgnored(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (IGNORED_KEYS.has(k)) continue;
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
      out[k] = processArray(v);
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
 * - Sorts parameters by name, required by value, enum by value
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
