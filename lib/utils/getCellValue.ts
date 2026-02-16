/**
 * Resolve a cell value from a record. Supports:
 * - Direct keys: record["id"]
 * - Dot paths: record["user.name"] -> record.user.name
 * - CamelCase fallback: "userName" -> record.user.name (when AI uses flattened names)
 */
export function getCellValue(
  record: Record<string, unknown>,
  fieldName: string
): unknown {
  const value = record[fieldName];
  if (value !== undefined && value !== null) return value;
  if (fieldName.includes(".")) return getValueByPath(record, fieldName);
  const dotPath = camelToDotPath(fieldName);
  if (dotPath !== fieldName) return getValueByPath(record, dotPath);
  return undefined;
}

function getValueByPath(
  record: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function camelToDotPath(camel: string): string {
  return camel.replace(/([A-Z])/g, (m) => "." + m.toLowerCase());
}
