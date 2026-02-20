/**
 * OpenAPI $ref resolver.
 * Resolves local refs only (same document). Inlines resolved schemas.
 * Rejects external refs and circular refs.
 */

import type { CompilerError } from "../errors";
import { createError } from "../errors";

function getByPointer(doc: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  const parts = ref.slice(2).split("/").map(decodePointerSegment);
  let current: unknown = doc;
  for (const p of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

function decodePointerSegment(seg: string): string {
  return seg.replace(/~1/g, "/").replace(/~0/g, "~");
}

function isExternalRef(ref: string): boolean {
  return (
    ref.startsWith("http://") ||
    ref.startsWith("https://") ||
    ref.startsWith("file://")
  );
}

type ResolveResult =
  | { ok: true; value: unknown }
  | { ok: false; error: CompilerError };

function resolveRef(
  doc: Record<string, unknown>,
  ref: string,
  stack: string[]
): ResolveResult {
  if (isExternalRef(ref)) {
    return {
      ok: false,
      error: createError(
        "OAS_EXTERNAL_REF",
        "Canonicalize",
        `External $ref not supported: ${ref}`,
        ref
      ),
    };
  }
  if (!ref.startsWith("#/")) {
    return {
      ok: false,
      error: createError(
        "OAS_EXTERNAL_REF",
        "Canonicalize",
        `Only local $ref (#/...) supported: ${ref}`,
        ref
      ),
    };
  }
  if (stack.includes(ref)) {
    return {
      ok: false,
      error: createError(
        "OAS_CIRCULAR_REF",
        "Canonicalize",
        `Circular $ref: ${ref}`,
        ref
      ),
    };
  }

  const target = getByPointer(doc, ref);
  if (target === undefined || target === null) {
    return {
      ok: false,
      error: createError(
        "OAS_EXTERNAL_REF",
        "Canonicalize",
        `Invalid $ref target: ${ref}`,
        ref
      ),
    };
  }

  const newStack = [...stack, ref];
  return transformRefs(target, doc, newStack);
}

function transformRefs(
  obj: unknown,
  doc: Record<string, unknown>,
  stack: string[]
): ResolveResult {
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    const o = obj as Record<string, unknown>;
    if ("$ref" in o && typeof o.$ref === "string") {
      return resolveRef(doc, o.$ref, stack);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const r = transformRefs(v, doc, stack);
      if (!r.ok) return r;
      out[k] = r.value;
    }
    return { ok: true, value: out };
  }
  if (Array.isArray(obj)) {
    const arr: unknown[] = [];
    for (const item of obj) {
      const r = transformRefs(item, doc, stack);
      if (!r.ok) return r;
      arr.push(r.value);
    }
    return { ok: true, value: arr };
  }
  return { ok: true, value: obj };
}

export interface ResolveRefsResult {
  success: true;
  doc: Record<string, unknown>;
}

export interface ResolveRefsFailure {
  success: false;
  error: CompilerError;
}

export type ResolveRefsOutput = ResolveRefsResult | ResolveRefsFailure;

/**
 * Resolve all local $ref in the document. Inline schemas. Reject external and circular refs.
 */
export function resolveRefs(
  doc: Record<string, unknown>
): ResolveRefsOutput {
  const result = transformRefs(doc, doc, []);
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return {
    success: true,
    doc: result.value as Record<string, unknown>,
  };
}
