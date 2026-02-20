/**
 * OpenAPI subset validator.
 * Rejects unsupported constructs with structured errors.
 * Same invalid spec → same ordered error list.
 */

import type { CompilerError } from "../errors";
import { createError } from "../errors";

const SUCCESS_CODES = ["200", "201"];
const METHODS_REQUIRING_BODY = ["post", "put", "patch"];
const METHOD_ORDER = ["get", "post", "put", "patch", "delete"];

function escapeJsonPointerSegment(s: string): string {
  return s.replace(/~/g, "~0").replace(/\//g, "~1");
}

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

function resolveLocalSchema(
  doc: Record<string, unknown>,
  ref: string
): Record<string, unknown> | null {
  if (!ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let current: unknown = doc;
  for (const p of parts) {
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === "object" && current !== null && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : null;
}

function hasUnsupportedKeyword(schema: Record<string, unknown>): boolean {
  return (
    "oneOf" in schema ||
    "anyOf" in schema ||
    "allOf" in schema
  );
}

function checkSchemaRecursive(
  doc: Record<string, unknown>,
  schema: Record<string, unknown>,
  pointer: string,
  visited: Set<string>
): CompilerError | null {
  if (hasUnsupportedKeyword(schema)) {
    if ("oneOf" in schema)
      return createError(
        "OAS_UNSUPPORTED_SCHEMA_KEYWORD",
        "Subset",
        "oneOf is not supported",
        pointer
      );
    if ("anyOf" in schema)
      return createError(
        "OAS_UNSUPPORTED_SCHEMA_KEYWORD",
        "Subset",
        "anyOf is not supported",
        pointer
      );
    if ("allOf" in schema)
      return createError(
        "OAS_UNSUPPORTED_SCHEMA_KEYWORD",
        "Subset",
        "allOf is not supported",
        pointer
      );
  }

  if ("$ref" in schema && typeof schema.$ref === "string") {
    const ref = schema.$ref as string;
    if (visited.has(ref)) return null;
    visited.add(ref);
    const resolved = resolveLocalSchema(doc, ref);
    if (resolved) {
      const err = checkSchemaRecursive(doc, resolved, ref, visited);
      if (err) return err;
    }
    visited.delete(ref);
    return null;
  }

  if ("items" in schema && typeof schema.items === "object" && schema.items) {
    const err = checkSchemaRecursive(
      doc,
      schema.items as Record<string, unknown>,
      `${pointer}/items`,
      visited
    );
    if (err) return err;
  }

  if ("properties" in schema && typeof schema.properties === "object") {
    const props = schema.properties as Record<string, unknown>;
    for (const [key, val] of Object.entries(props)) {
      if (val && typeof val === "object") {
        const err = checkSchemaRecursive(
          doc,
          val as Record<string, unknown>,
          `${pointer}/properties/${key}`,
          visited
        );
        if (err) return err;
      }
    }
  }

  return null;
}

export interface ValidateResult {
  success: true;
}

export interface ValidateFailure {
  success: false;
  errors: CompilerError[];
}

export type ValidateOutput = ValidateResult | ValidateFailure;

export function validateSubset(doc: Record<string, unknown>): ValidateOutput {
  const errors: CompilerError[] = [];
  const paths = doc.paths as Record<string, unknown> | undefined;
  if (!paths || typeof paths !== "object") {
    return { success: true };
  }

  const pathKeys = Object.keys(paths).sort();

  for (const pathKey of pathKeys) {
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== "object") continue;

    const pathParams = extractPathParams(pathKey);
    if (pathParams.length > 1) {
      errors.push(
        createError(
          "OAS_MULTIPLE_PATH_PARAMS",
          "Subset",
          `Path has multiple path parameters: ${pathParams.join(", ")}`,
          `/paths/${escapeJsonPointerSegment(pathKey)}`
        )
      );
    }

    const pathObj = pathItem as Record<string, unknown>;
    for (const method of METHOD_ORDER) {
      const op = pathObj[method] as Record<string, unknown> | undefined;
      if (!op || typeof op !== "object") continue;

      const opPath = `/paths/${escapeJsonPointerSegment(pathKey)}/${method}`;

      const tags = op.tags;
      if (Array.isArray(tags) && tags.length > 1) {
        errors.push(
          createError(
            "OAS_MULTIPLE_TAGS",
            "Subset",
            `Operation has multiple tags: ${tags.join(", ")}`,
            opPath
          )
        );
      }

      const responses = op.responses as Record<string, unknown> | undefined;
      if (responses && typeof responses === "object") {
        const successCount = SUCCESS_CODES.filter((c) => c in responses).length;
        if (successCount > 1) {
          errors.push(
            createError(
              "OAS_MULTIPLE_SUCCESS_RESPONSES",
              "Subset",
              `Operation has multiple success responses (200 and/or 201)`,
              opPath
            )
          );
        }
      }

      if (METHODS_REQUIRING_BODY.includes(method)) {
        if (!op.requestBody) {
          errors.push(
            createError(
              "OAS_MISSING_REQUEST_BODY",
              "Subset",
              `${method.toUpperCase()} requires requestBody`,
              opPath
            )
          );
        }
      }

      if (responses && typeof responses === "object") {
        for (const [code, resp] of Object.entries(responses)) {
          if (!SUCCESS_CODES.includes(code)) continue;
          const r = resp as Record<string, unknown> | undefined;
          const contentObj = r?.content as Record<string, unknown> | undefined;
          const content = contentObj?.["application/json"];
          if (!content || typeof content !== "object") continue;
          const schema = (content as Record<string, unknown>)?.schema;
          if (!schema || typeof schema !== "object") continue;
          const schemaPointer = `${opPath}/responses/${code}/content/application~1json/schema`;
          const visited = new Set<string>();
          const err = checkSchemaRecursive(
            doc,
            schema as Record<string, unknown>,
            schemaPointer,
            visited
          );
          if (err) errors.push(err);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }
  return { success: true };
}
