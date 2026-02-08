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
    try {
      return generateSpec(parsed);
    } catch (generateError) {
      // If spec generation fails (e.g., empty object), use fallback
      console.warn("Failed to generate spec, using fallback:", generateError);
      throw generateError; // Re-throw to trigger fallback
    }
  } catch (error) {
    // If parsing or generation fails, return a minimal valid spec
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
