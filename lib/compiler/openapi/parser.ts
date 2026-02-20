/**
 * OpenAPI parser: YAML and JSON.
 * Detects version (3.0 vs 3.1) and returns parsed document.
 */

import { parse as parseYaml } from "yaml";
import type { CompilerError } from "../errors";

export type OpenApiVersion = "3.0" | "3.1";

export interface ParseResult {
  success: true;
  doc: Record<string, unknown>;
  version: OpenApiVersion;
}

export interface ParseFailure {
  success: false;
  error: CompilerError;
}

export type ParseOutput = ParseResult | ParseFailure;

function detectVersion(doc: Record<string, unknown>): OpenApiVersion {
  const openapi = doc.openapi;
  if (typeof openapi !== "string") return "3.0";
  if (openapi.startsWith("3.1")) return "3.1";
  return "3.0";
}

function looksLikeJson(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * Parse OpenAPI from string (YAML or JSON).
 */
export function parseOpenAPI(input: string): ParseOutput {
  if (!input.trim()) {
    return {
      success: false,
      error: {
        code: "OAS_PARSE_ERROR",
        stage: "Parse",
        message: "Empty input",
      },
    };
  }

  try {
    let doc: Record<string, unknown>;

    if (looksLikeJson(input)) {
      doc = JSON.parse(input) as Record<string, unknown>;
    } else {
      const parsed = parseYaml(input);
      if (parsed === null || parsed === undefined) {
        return {
          success: false,
          error: {
            code: "OAS_PARSE_ERROR",
            stage: "Parse",
            message: "YAML parsed to null/undefined",
          },
        };
      }
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          success: false,
          error: {
            code: "OAS_PARSE_ERROR",
            stage: "Parse",
            message: "Expected object root",
          },
        };
      }
      doc = parsed as Record<string, unknown>;
    }

    const version = detectVersion(doc);
    return { success: true, doc, version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: {
        code: "OAS_PARSE_ERROR",
        stage: "Parse",
        message: `Parse error: ${message}`,
      },
    };
  }
}
