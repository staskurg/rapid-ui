/**
 * Unflatten flat record for API submit.
 * { "profile.firstName": "Alice" } → { profile: { firstName: "Alice" } }
 * Used when FormModal submits; adapter.create/update expect nested structure.
 */

export function unflattenRecord(
  flat: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;

    const parts = key.split(".");
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const next = current[part];
      const nextObj =
        next !== undefined &&
        typeof next === "object" &&
        next !== null &&
        !Array.isArray(next)
          ? (next as Record<string, unknown>)
          : {};
      if (next === undefined) current[part] = nextObj;
      current = nextObj as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  return result;
}
