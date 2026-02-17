/**
 * Extract array from API response. Supports:
 * - Direct array: returns as-is
 * - Wrapped object: uses dataPath or auto-detects (data, results, items, records)
 */

const COMMON_KEYS = ["data", "results", "items", "records", "users"] as const;

/**
 * Extract array from response body.
 * @param body - Parsed JSON response
 * @param dataPath - Optional dot-notation path (top-level keys only, e.g. "data" or "results.items")
 * @returns Array of records, or empty array if not found
 */
export function extractArrayFromResponse(
  body: unknown,
  dataPath?: string
): unknown[] {
  if (body === null || body === undefined) {
    return [];
  }

  if (Array.isArray(body)) {
    return body;
  }

  if (typeof body !== "object") {
    return [];
  }

  const obj = body as Record<string, unknown>;

  if (dataPath && dataPath.trim()) {
    const value = getByPath(obj, dataPath.trim());
    return Array.isArray(value) ? value : [];
  }

  // Auto-detect: try common keys
  for (const key of COMMON_KEYS) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

/**
 * Get value by dot-notation path. Top-level keys only (no nested objects).
 * e.g. "data" -> obj.data, "results.items" -> obj.results?.items
 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
