/**
 * Spec Generator - Converts parsed structure to validated UISpec
 */

import { UISpecSchema, type UISpec } from "@/lib/spec/schema";
import type { ParsedStructure } from "./payload-parser";

/**
 * Generate a UI spec from a parsed structure
 */
export function generateSpec(
  parsed: ParsedStructure,
  entityName?: string
): UISpec {
  const fieldNames = parsed.fields.map((f) => f.name);

  // Convert parsed fields to UISpec fields
  const fields = parsed.fields.map((field) => {
    const specField: {
      name: string;
      label: string;
      type: "string" | "number" | "boolean" | "enum";
      required: boolean;
      options?: string[];
    } = {
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
    };

    if (field.type === "enum" && field.options) {
      specField.options = field.options;
    }

    return specField;
  });

  // Create UISpec with defaults
  const spec: UISpec = {
    entity: entityName || "Entity",
    fields,
    table: {
      columns: fieldNames, // All fields in table by default
    },
    form: {
      fields: fieldNames, // All fields in form by default
    },
    filters: parsed.fields
      .filter((f) => f.type === "string" || f.type === "number")
      .map((f) => f.name), // Only string and number fields filterable by default
  };

  // Validate with Zod schema
  return UISpecSchema.parse(spec);
}
