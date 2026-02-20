/**
 * Resource grouping for ApiIR.
 * If all ops have exactly one tag → group by tag.
 * Else: strip path prefixes, take first segment as resource key.
 * Ambiguous → compile error.
 */

import type { CompilerError } from "../errors";
import { createError } from "../errors";
import { slugify } from "@/lib/utils/slugify";

const PATH_PREFIXES = ["api", "v1", "v2", "v3"];
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export interface RawOperation {
  path: string;
  method: string;
  operationId?: string;
  tags?: string[];
}

function extractPathSegments(path: string): string[] {
  return path
    .split("/")
    .filter(Boolean)
    .filter((seg) => !seg.startsWith("{"));
}

function stripPrefixes(segments: string[]): string[] {
  let i = 0;
  while (i < segments.length && PATH_PREFIXES.includes(segments[i].toLowerCase())) {
    i++;
  }
  return segments.slice(i);
}

function getPathBasedResourceKey(path: string): string {
  const segments = extractPathSegments(path);
  const stripped = stripPrefixes(segments);
  const first = stripped[0];
  if (!first) {
    return "resource";
  }
  return first.toLowerCase();
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export type GroupingStrategy = "tag" | "path";

export interface GroupingResult {
  success: true;
  strategy: GroupingStrategy;
  /** Map resourceKey → { name, operations } */
  groups: Map<string, { name: string; operations: RawOperation[] }>;
}

export interface GroupingFailure {
  success: false;
  error: CompilerError;
}

export type GroupingOutput = GroupingResult | GroupingFailure;

/**
 * Group operations by resource.
 * Uses tag-based grouping if ALL operations have exactly one tag.
 * Otherwise uses path-based grouping.
 */
export function groupOperations(
  paths: Record<string, unknown>
): GroupingOutput {
  const allOps: RawOperation[] = [];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const pathObj = pathItem as Record<string, unknown>;
    for (const method of METHODS) {
      const op = pathObj[method];
      if (!op || typeof op !== "object") continue;
      const opObj = op as Record<string, unknown>;
      allOps.push({
        path: pathKey,
        method,
        operationId: opObj.operationId as string | undefined,
        tags: opObj.tags as string[] | undefined,
      });
    }
  }

  if (allOps.length === 0) {
    return {
      success: false,
      error: createError(
        "OAS_AMBIGUOUS_RESOURCE_GROUPING",
        "ApiIR",
        "No CRUD operations found in paths"
      ),
    };
  }

  const allHaveSingleTag = allOps.every(
    (op) => Array.isArray(op.tags) && op.tags.length === 1
  );

  if (allHaveSingleTag) {
    const groups = new Map<string, { name: string; operations: RawOperation[] }>();
    for (const op of allOps) {
      const tag = op.tags![0];
      const key = slugify(tag);
      const existing = groups.get(key);
      if (existing) {
        existing.operations.push(op);
      } else {
        groups.set(key, {
          name: tag,
          operations: [op],
        });
      }
    }
    return {
      success: true,
      strategy: "tag",
      groups,
    };
  }

  const groups = new Map<string, { name: string; operations: RawOperation[] }>();
  for (const op of allOps) {
    const key = getPathBasedResourceKey(op.path);
    const name = capitalize(getPathBasedResourceKey(op.path));
    const existing = groups.get(key);
    if (existing) {
      existing.operations.push(op);
    } else {
      groups.set(key, {
        name,
        operations: [op],
      });
    }
  }
  return {
    success: true,
    strategy: "path",
    groups,
  };
}
