/**
 * Flatten nested record for form initialValues.
 * { profile: { firstName: "Alice" } } → { "profile.firstName": "Alice" }
 * Used when FormModal receives nested record; form fields use dot-path names.
 */

export function flattenRecord(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      value !== null &&
      value !== undefined &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const nested = value as Record<string, unknown>;
      if (Object.keys(nested).length === 0) {
        result[path] = value;
      } else {
        Object.assign(result, flattenRecord(nested, path));
      }
    } else {
      result[path] = value;
    }
  }

  return result;
}
