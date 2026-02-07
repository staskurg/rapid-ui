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
 * Convert camelCase to Title Case
 * e.g., "firstName" -> "First Name", "userName" -> "User Name"
 */
function camelCaseToTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .replace(/^./, (char) => char.toUpperCase()) // Capitalize first letter
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
      throw new Error("Payload array is empty");
    }
    // Use first element structure
    records = payload as Record<string, unknown>[];
  } else if (payload !== null && typeof payload === "object") {
    // Single object - wrap in array
    records = [payload as Record<string, unknown>];
  } else {
    throw new Error("Payload must be an object or array of objects");
  }

  // Flatten nested objects
  const flattenedRecords = records.map((record) => flattenObject(record));

  // Get all field names from all records
  const allFieldNames = new Set<string>();
  flattenedRecords.forEach((record) => {
    Object.keys(record).forEach((key) => allFieldNames.add(key));
  });

  // Parse each field
  const fields: ParsedField[] = Array.from(allFieldNames).map((fieldName) => {
    const allValues = getAllValuesForField(flattenedRecords, fieldName);
    
    // Use first non-null value for type inference
    const sampleValue = allValues.find((v) => v !== null && v !== undefined);
    
    if (sampleValue === undefined) {
      // Default to string if no values found
      return {
        name: fieldName,
        label: camelCaseToTitleCase(fieldName),
        type: "string",
        required: false,
      };
    }

    const type = inferFieldType(sampleValue, allValues);
    
    // Determine if field is required (if all records have non-null values)
    const required = allValues.length === flattenedRecords.length;

    const parsedField: ParsedField = {
      name: fieldName,
      label: camelCaseToTitleCase(fieldName),
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
