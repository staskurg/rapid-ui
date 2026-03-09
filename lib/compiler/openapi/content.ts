/**
 * Content negotiation for OpenAPI.
 * Deterministic rule: select JSON media type when present; else fail.
 * Supports: application/json, +json suffix, /json suffix (e.g. text/json, application/x-json).
 */

/**
 * Check if media type is JSON.
 * Priority: application/json, then +json suffix, then /json suffix (e.g. text/json, application/x-json).
 */
function isJsonMediaType(mediaType: string): boolean {
  if (mediaType === "application/json") return true;
  if (mediaType.endsWith("+json")) return true;
  if (mediaType.endsWith("/json")) return true;
  return false;
}

/**
 * Select JSON schema from a content object (responses or requestBody).
 * Priority: application/json first, then types ending with +json (lexicographic).
 * Returns the schema for the selected JSON media type, or null if none.
 */
export function selectJsonContent(
  content: Record<string, unknown> | undefined
): { schema: Record<string, unknown> } | null {
  if (!content || typeof content !== "object") return null;

  const keys = Object.keys(content).sort();
  for (const key of keys) {
    if (!isJsonMediaType(key)) continue;
    const entry = content[key];
    if (!entry || typeof entry !== "object") continue;
    const schema = (entry as Record<string, unknown>).schema;
    if (!schema || typeof schema !== "object") continue;
    return { schema: schema as Record<string, unknown> };
  }
  return null;
}

/** Check if content has any JSON media type (for validator). */
export function hasJsonContent(content: Record<string, unknown> | undefined): boolean {
  return selectJsonContent(content) !== null;
}
