/**
 * Fallback Generator - Always returns a valid UISpec, even for invalid payloads
 */

import { UISpecSchema, type UISpec } from "@/lib/spec/schema";
import { parsePayload } from "./payload-parser";
import { generateSpec } from "./spec-generator";

/**
 * Generate a fallback UI spec from a payload
 * Always returns a valid UISpec (never throws)
 */
export function generateFallbackSpec(payload: unknown): UISpec {
  try {
    // Try to parse and generate spec normally
    const parsed = parsePayload(payload);
    return generateSpec(parsed);
  } catch (error) {
    // If parsing fails, return a minimal valid spec
    console.warn("Failed to parse payload, using fallback spec:", error);
    
    const fallbackSpec: UISpec = {
      entity: "Entity",
      fields: [
        {
          name: "id",
          label: "ID",
          type: "number",
          required: true,
        },
        {
          name: "data",
          label: "Data",
          type: "string",
          required: false,
        },
      ],
      table: {
        columns: ["id", "data"],
      },
      form: {
        fields: ["data"],
      },
      filters: ["data"],
    };

    // Validate fallback spec (should always pass)
    return UISpecSchema.parse(fallbackSpec);
  }
}
