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

/**
 * Validates OpenAPI version. Rejects 2.x, 1.x, missing, malformed.
 * Accepts only 3.0.x and 3.1.x.
 */
function validateOpenApiVersion(doc: Record<string, unknown>): { ok: true; version: OpenApiVersion } | { ok: false; error: CompilerError } {
  const openapi = doc.openapi;
  if (openapi === undefined || openapi === null) {
    return {
      ok: false,
      error: {
        code: "OAS_UNSUPPORTED_VERSION",
        stage: "Parse",
        message: "Missing openapi version field",
      },
    };
  }
  if (typeof openapi !== "string") {
    return {
      ok: false,
      error: {
        code: "OAS_UNSUPPORTED_VERSION",
        stage: "Parse",
        message: `openapi must be a string, got ${typeof openapi}`,
      },
    };
  }
  const v = openapi.trim();
  if (v.startsWith("1.")) {
    return {
      ok: false,
      error: {
        code: "OAS_UNSUPPORTED_VERSION",
        stage: "Parse",
        message: `OpenAPI 1.x is not supported (got ${openapi})`,
      },
    };
  }
  if (v.startsWith("2.")) {
    return {
      ok: false,
      error: {
        code: "OAS_UNSUPPORTED_VERSION",
        stage: "Parse",
        message: `OpenAPI 2.x (Swagger) is not supported (got ${openapi})`,
      },
    };
  }
  if (v.startsWith("3.1")) {
    return { ok: true, version: "3.1" };
  }
  if (v.startsWith("3.0")) {
    return { ok: true, version: "3.0" };
  }
  return {
    ok: false,
    error: {
      code: "OAS_UNSUPPORTED_VERSION",
      stage: "Parse",
      message: `Unsupported OpenAPI version (got ${openapi}). Only 3.0.x and 3.1.x are supported.`,
    },
  };
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

    const versionResult = validateOpenApiVersion(doc);
    if (!versionResult.ok) {
      return { success: false, error: versionResult.error };
    }
    return { success: true, doc, version: versionResult.version };
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
