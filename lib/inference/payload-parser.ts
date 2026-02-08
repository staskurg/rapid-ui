/**
 * Payload Parser - Parses JSON payloads and extracts structure information
 */

export interface ParsedField {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  options?: string[]; // For enum type
}

export interface ParsedStructure {
  fields: ParsedField[];
}

/**
 * Sanitize field name to ensure it's safe for use in forms/tables
 * Removes or replaces special characters that could cause issues
 */
function sanitizeFieldName(name: string): string {
  // Replace spaces and special characters with underscores
  // Keep alphanumeric, dots (for nested fields), and underscores
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores
}

/**
 * Convert camelCase to Title Case
 * e.g., "firstName" -> "First Name", "userName" -> "User Name", "user.name" -> "User Name"
 */
function camelCaseToTitleCase(str: string): string {
  // First sanitize the string
  const sanitized = sanitizeFieldName(str);
  return sanitized
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .replace(/[._]/g, " ") // Replace dots and underscores with spaces
    .split(/\s+/) // Split into words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
    .join(" ") // Join with spaces
    .trim();
}

/**
 * Infer field type from a value
 */
function inferFieldType(
  value: unknown,
  allValues: unknown[]
): "string" | "number" | "boolean" | "enum" {
  if (typeof value === "string") {
    // Check if it's an enum (limited distinct values ≤ 5)
    const uniqueValues = new Set(allValues.map(String));
    if (uniqueValues.size > 1 && uniqueValues.size <= 5) {
      return "enum";
    }
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  // Default to string for unknown types
  return "string";
}

/**
 * Flatten nested objects by prefixing keys with parent key
 * e.g., { user: { name: "John" } } -> { "user.name": "John" }
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

/**
 * Extract all values for a field across all records
 */
function getAllValuesForField(
  records: Record<string, unknown>[],
  fieldName: string
): unknown[] {
  return records
    .map((record) => record[fieldName])
    .filter((value) => value !== undefined && value !== null);
}

/**
 * Parse a JSON payload and extract structure information
 */
export function parsePayload(payload: unknown): ParsedStructure {
  // Handle array of objects
  let records: Record<string, unknown>[];
  
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error("Payload array is empty. Please provide at least one object in the array.");
    }
    // Filter out null/undefined elements and check if we have valid objects
    const validRecords = payload.filter(
      (item) => item !== null && item !== undefined && typeof item === "object" && !Array.isArray(item)
    );
    if (validRecords.length === 0) {
      throw new Error("Payload array contains no valid objects. All elements are null, undefined, or invalid.");
    }
    // Use first element structure
    records = validRecords as Record<string, unknown>[];
  } else if (payload === null) {
    throw new Error("Payload cannot be null. Please provide an object or array of objects.");
  } else if (typeof payload === "object" && !Array.isArray(payload)) {
    // Single object - wrap in array
    // Check if object is empty
    if (Object.keys(payload).length === 0) {
      throw new Error("Payload object is empty. Please provide an object with at least one field.");
    }
    records = [payload as Record<string, unknown>];
  } else {
    const receivedType = payload === null ? "null" : typeof payload;
    throw new Error("Payload must be an object or array of objects. Received: " + receivedType);
  }

  // Flatten nested objects
  const flattenedRecords = records.map((record) => flattenObject(record));

  // Get all field names from all records
  const allFieldNames = new Set<string>();
  flattenedRecords.forEach((record) => {
    Object.keys(record).forEach((key) => allFieldNames.add(key));
  });

  // Check if we have any fields after flattening
  if (allFieldNames.size === 0) {
    throw new Error("Payload contains no fields after parsing (empty object or all null values)");
  }

  // Parse each field
  const fields: ParsedField[] = Array.from(allFieldNames).map((fieldName) => {
    // Keep original field name for data access (must match JSON keys exactly)
    // Only sanitize for display in labels
    const allValues = getAllValuesForField(flattenedRecords, fieldName);
    
    // Use first non-null value for type inference
    const sampleValue = allValues.find((v) => v !== null && v !== undefined);
    
    if (sampleValue === undefined) {
      // Default to string if no values found (all null/undefined)
      return {
        name: fieldName, // Keep original name for data access
        label: camelCaseToTitleCase(fieldName), // Sanitized label for display
        type: "string",
        required: false,
      };
    }

    const type = inferFieldType(sampleValue, allValues);
    
    // Determine if field is required (if all records have non-null values)
    const required = allValues.length === flattenedRecords.length;

    const parsedField: ParsedField = {
      name: fieldName, // Keep original name for data access
      label: camelCaseToTitleCase(fieldName), // Sanitized label for display
      type,
      required,
    };

    // Add options for enum type
    if (type === "enum") {
      const uniqueValues = Array.from(new Set(allValues.map(String))).sort();
      parsedField.options = uniqueValues;
    }

    return parsedField;
  });

  return { fields };
}
