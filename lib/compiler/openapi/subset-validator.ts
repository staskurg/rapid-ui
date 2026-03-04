/**
 * OpenAPI subset validator.
 * Allowlist-based: only supported constructs exist; unknown → compile error.
 * Same invalid spec → same ordered error list.
 */

import type { CompilerError } from "../errors";
import { createError } from "../errors";

const SUCCESS_CODES = ["200", "201"];
const METHODS_REQUIRING_BODY = ["post", "put", "patch"];
const METHODS_FORBIDDEN_BODY = ["get", "delete"];
const METHOD_ORDER = ["get", "post", "put", "patch", "delete"];

const ALLOWED_SCHEMA_KEYS = new Set([
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "nullable",
  "format",
  "description",
  "$ref",
  "additionalProperties",
  "minimum",
  "maximum",
]);

const REF_ONLY_KEYS = new Set(["$ref", "description"]);
const PRIMITIVE_TYPES = new Set(["string", "integer", "number", "boolean"]);
const PATH_PARAM_TYPES = new Set(["string", "integer"]);

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

/** Resolve schema by following $ref until concrete schema (no $ref) */
function resolveSchemaToConcrete(
  doc: Record<string, unknown>,
  schema: Record<string, unknown>,
  visited: Set<string>
): Record<string, unknown> | null {
  if (!("$ref" in schema) || typeof schema.$ref !== "string") {
    return schema;
  }
  const ref = schema.$ref as string;
  if (visited.has(ref)) return null;
  visited.add(ref);
  const resolved = resolveLocalSchema(doc, ref);
  visited.delete(ref);
  if (!resolved) return null;
  return resolveSchemaToConcrete(doc, resolved, visited);
}

/** Get primary type from type field (handles "string" or ["string","null"]) */
function getPrimaryType(schema: Record<string, unknown>): string | null {
  const t = schema.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    const prim = (t as unknown[]).filter((x) => x !== "null");
    return prim.length === 1 ? (prim[0] as string) : null;
  }
  return null;
}

function checkSchemaRecursive(
  doc: Record<string, unknown>,
  schema: Record<string, unknown>,
  pointer: string,
  visited: Set<string>
): CompilerError | null {
  // $ref rule: when $ref present, only $ref and description allowed
  if ("$ref" in schema && typeof schema.$ref === "string") {
    for (const key of Object.keys(schema)) {
      if (!REF_ONLY_KEYS.has(key)) {
        return createError(
          "OAS_INVALID_SCHEMA_SHAPE",
          "Subset",
          `When $ref is present, only $ref and description are allowed; found: ${key}`,
          pointer
        );
      }
    }
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

  // Allowlist: unknown schema keyword → error
  for (const key of Object.keys(schema)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) {
      return createError(
        "OAS_UNSUPPORTED_SCHEMA_KEYWORD",
        "Subset",
        `Unsupported schema keyword: ${key}`,
        pointer
      );
    }
  }

  // additionalProperties must be false if present
  if ("additionalProperties" in schema) {
    const ap = schema.additionalProperties;
    if (ap !== false) {
      return createError(
        "OAS_INVALID_SCHEMA_SHAPE",
        "Subset",
        "additionalProperties must be false if present",
        pointer
      );
    }
  }

  // Schema hygiene: required ⊆ properties
  if ("required" in schema && Array.isArray(schema.required)) {
    const props = schema.properties as Record<string, unknown> | undefined;
    const propKeys = props && typeof props === "object" ? new Set(Object.keys(props)) : new Set<string>();
    for (const r of schema.required as unknown[]) {
      if (typeof r === "string" && !propKeys.has(r)) {
        return createError(
          "OAS_INVALID_SCHEMA_SHAPE",
          "Subset",
          `required references non-existent property: ${r}`,
          pointer
        );
      }
    }
  }

  // Schema hygiene: type: array → items required; reject array of array
  if (schema.type === "array" || (Array.isArray(schema.type) && (schema.type as unknown[]).includes("array"))) {
    if (!("items" in schema) || !schema.items || typeof schema.items !== "object") {
      return createError(
        "OAS_INVALID_SCHEMA_SHAPE",
        "Subset",
        "type: array requires items",
        pointer
      );
    }
    const items = schema.items as Record<string, unknown>;
    if (items.type === "array" || (Array.isArray(items.type) && (items.type as unknown[]).includes("array"))) {
      return createError(
        "OAS_INVALID_SCHEMA_SHAPE",
        "Subset",
        "array of array is not supported",
        `${pointer}/items`
      );
    }
  }

  // Schema hygiene: type: object → properties required
  if (schema.type === "object" || (Array.isArray(schema.type) && (schema.type as unknown[]).includes("object"))) {
    if (!("properties" in schema) || !schema.properties || typeof schema.properties !== "object") {
      return createError(
        "OAS_INVALID_SCHEMA_SHAPE",
        "Subset",
        "type: object requires properties",
        pointer
      );
    }
  }

  // Schema hygiene: enum values must match type
  if ("enum" in schema && Array.isArray(schema.enum)) {
    const primaryType = getPrimaryType(schema);
    const enumValues = schema.enum as unknown[];
    if (primaryType === "string") {
      if (!enumValues.every((v) => typeof v === "string")) {
        return createError(
          "OAS_INVALID_SCHEMA_SHAPE",
          "Subset",
          "enum values must match type: string",
          pointer
        );
      }
    } else if (primaryType === "integer" || primaryType === "number") {
      if (!enumValues.every((v) => typeof v === "number")) {
        return createError(
          "OAS_INVALID_SCHEMA_SHAPE",
          "Subset",
          `enum values must match type: ${primaryType}`,
          pointer
        );
      }
    } else if (primaryType === "boolean") {
      if (!enumValues.every((v) => typeof v === "boolean")) {
        return createError(
          "OAS_INVALID_SCHEMA_SHAPE",
          "Subset",
          "enum values must match type: boolean",
          pointer
        );
      }
    }
    // If no type or type is object/array, enum is unusual; allow for now (object enum is rare)
  }

  // Recurse into items
  if ("items" in schema && typeof schema.items === "object" && schema.items) {
    const err = checkSchemaRecursive(
      doc,
      schema.items as Record<string, unknown>,
      `${pointer}/items`,
      visited
    );
    if (err) return err;
  }

  // Recurse into properties
  if ("properties" in schema && typeof schema.properties === "object") {
    const props = schema.properties as Record<string, unknown>;
    for (const [key, val] of Object.entries(props)) {
      if (val && typeof val === "object") {
        const err = checkSchemaRecursive(
          doc,
          val as Record<string, unknown>,
          `${pointer}/properties/${escapeJsonPointerSegment(key)}`,
          visited
        );
        if (err) return err;
      }
    }
  }

  return null;
}

function validateParameterSchema(
  doc: Record<string, unknown>,
  param: Record<string, unknown>,
  paramIndex: number,
  opPath: string,
  inLocation: "path" | "query"
): CompilerError | null {
  const paramPointer = `${opPath}/parameters/${paramIndex}`;
  const schema = param.schema as Record<string, unknown> | undefined;
  if (!schema || typeof schema !== "object") {
    return createError(
      "OAS_INVALID_PARAMETER",
      "Subset",
      "Parameter must have schema",
      paramPointer
    );
  }

  const schemaPointer = `${paramPointer}/schema`;
  const visited = new Set<string>();

  // Allowlist + hygiene (same as request/response)
  const allowlistErr = checkSchemaRecursive(doc, schema, schemaPointer, visited);
  if (allowlistErr) return allowlistErr;

  // Resolve to concrete for type check
  const concrete = resolveSchemaToConcrete(doc, schema, new Set<string>());
  if (!concrete) {
    return createError(
      "OAS_INVALID_PARAMETER",
      "Subset",
      "Parameter schema $ref could not be resolved",
      schemaPointer
    );
  }

  const primaryType = getPrimaryType(concrete);

  if (inLocation === "path") {
    if (!primaryType || !PATH_PARAM_TYPES.has(primaryType)) {
      return createError(
        "OAS_INVALID_PARAMETER",
        "Subset",
        `Path parameter schema must be string or integer; got ${primaryType ?? "unknown"}`,
        schemaPointer
      );
    }
  } else {
    // query
    if (!primaryType || !PRIMITIVE_TYPES.has(primaryType)) {
      return createError(
        "OAS_INVALID_PARAMETER",
        "Subset",
        `Query parameter schema must resolve to primitive (string, integer, number, boolean); got ${primaryType ?? "object/array"}`,
        schemaPointer
      );
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

  // Empty paths → reject
  if (!paths || typeof paths !== "object") {
    errors.push(
      createError(
        "OAS_INVALID_OPERATION_STRUCTURE",
        "Subset",
        "paths must not be empty",
        "/paths"
      )
    );
    return { success: false, errors };
  }

  const pathKeys = Object.keys(paths).sort();
  if (pathKeys.length === 0) {
    errors.push(
      createError(
        "OAS_INVALID_OPERATION_STRUCTURE",
        "Subset",
        "paths must not be empty",
        "/paths"
      )
    );
    return { success: false, errors };
  }

  let validOpCount = 0;

  for (const pathKey of pathKeys) {
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== "object") continue;

    const pathObj = pathItem as Record<string, unknown>;
    const pathPointer = `/paths/${escapeJsonPointerSegment(pathKey)}`;

    // Path-level parameters → reject
    if ("parameters" in pathObj && pathObj.parameters !== undefined) {
      errors.push(
        createError(
          "OAS_INVALID_OPERATION_STRUCTURE",
          "Subset",
          "Parameters must be at operation level only; path-level parameters are not supported",
          pathPointer
        )
      );
    }

    // Path must have ≥1 supported method
    const supportedMethodsOnPath = METHOD_ORDER.filter(
      (m) => pathObj[m] && typeof pathObj[m] === "object"
    );
    if (supportedMethodsOnPath.length === 0) {
      errors.push(
        createError(
          "OAS_INVALID_OPERATION_STRUCTURE",
          "Subset",
          "Path must have at least one supported operation (GET, POST, PUT, PATCH, DELETE)",
          pathPointer
        )
      );
    }

    const pathParams = extractPathParams(pathKey);
    if (pathParams.length > 1) {
      errors.push(
        createError(
          "OAS_MULTIPLE_PATH_PARAMS",
          "Subset",
          `Path has multiple path parameters: ${pathParams.join(", ")}`,
          pathPointer
        )
      );
    }

    for (const method of METHOD_ORDER) {
      const op = pathObj[method] as Record<string, unknown> | undefined;
      if (!op || typeof op !== "object") continue;

      validOpCount++;
      const opPath = `${pathPointer}/${method}`;

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

      // Parameter schema validation (path + query)
      const parameters = op.parameters as Record<string, unknown>[] | undefined;
      if (parameters && Array.isArray(parameters)) {
        for (let i = 0; i < parameters.length; i++) {
          const param = parameters[i];
          if (!param || typeof param !== "object") continue;
          const paramObj = param as Record<string, unknown>;
          const inLocation = paramObj.in as string | undefined;
          if (inLocation === "path" || inLocation === "query") {
            const err = validateParameterSchema(
              doc,
              paramObj,
              i,
              opPath,
              inLocation as "path" | "query"
            );
            if (err) errors.push(err);
          }
          // header, cookie: ignored for v1
        }
      }

      const responses = op.responses as Record<string, unknown> | undefined;
      const successCount = responses && typeof responses === "object"
        ? SUCCESS_CODES.filter((c) => c in responses).length
        : 0;

      // Missing success response → reject
      if (successCount === 0) {
        errors.push(
          createError(
            "OAS_INVALID_OPERATION_STRUCTURE",
            "Subset",
            "Operation must have exactly one success response (200 or 201)",
            opPath
          )
        );
      } else if (successCount > 1) {
        errors.push(
          createError(
            "OAS_MULTIPLE_SUCCESS_RESPONSES",
            "Subset",
            "Operation has multiple success responses (200 and/or 201)",
            opPath
          )
        );
      }

      // GET/DELETE must NOT have requestBody
      if (METHODS_FORBIDDEN_BODY.includes(method) && op.requestBody) {
        errors.push(
          createError(
            "OAS_INVALID_OPERATION_STRUCTURE",
            "Subset",
            `${method.toUpperCase()} must not have requestBody`,
            opPath
          )
        );
      }

      // POST/PUT/PATCH must have requestBody
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

      // Request body schema validation (for POST/PUT/PATCH)
      if (METHODS_REQUIRING_BODY.includes(method) && op.requestBody) {
        const rb = op.requestBody as Record<string, unknown>;
        const content = rb?.content as Record<string, unknown> | undefined;
        if (content && typeof content === "object") {
          const contentKeys = Object.keys(content);
          if (contentKeys.length !== 1 || !("application/json" in content)) {
            errors.push(
              createError(
                "OAS_INVALID_OPERATION_STRUCTURE",
                "Subset",
                "requestBody content must have exactly one key: application/json",
                `${opPath}/requestBody`
              )
            );
          } else {
            const jsonContent = content["application/json"] as Record<string, unknown> | undefined;
            const schema = jsonContent?.schema;
            if (!schema || typeof schema !== "object") {
              errors.push(
                createError(
                  "OAS_INVALID_OPERATION_STRUCTURE",
                  "Subset",
                  "requestBody content must have schema for application/json",
                  `${opPath}/requestBody/content/application~1json`
                )
              );
            } else {
              const schemaPointer = `${opPath}/requestBody/content/application~1json/schema`;
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

      // Response validation
      if (responses && typeof responses === "object") {
        for (const [code, resp] of Object.entries(responses)) {
          if (!SUCCESS_CODES.includes(code)) continue;
          const r = resp as Record<string, unknown> | undefined;
          const contentObj = r?.content as Record<string, unknown> | undefined;

          // Content object must have exactly one key: application/json
          if (!contentObj || typeof contentObj !== "object") {
            errors.push(
              createError(
                "OAS_INVALID_RESPONSE_STRUCTURE",
                "Subset",
                "Success response must have content with application/json",
                `${opPath}/responses/${code}`
              )
            );
            continue;
          }
          const contentKeys = Object.keys(contentObj);
          if (contentKeys.length !== 1 || !("application/json" in contentObj)) {
            errors.push(
              createError(
                "OAS_INVALID_RESPONSE_STRUCTURE",
                "Subset",
                "Success response content must have exactly one key: application/json",
                `${opPath}/responses/${code}/content`
              )
            );
            continue;
          }

          const content = contentObj["application/json"];
          if (!content || typeof content !== "object") {
            errors.push(
              createError(
                "OAS_INVALID_RESPONSE_STRUCTURE",
                "Subset",
                "Success response must have schema",
                `${opPath}/responses/${code}/content/application~1json`
              )
            );
            continue;
          }

          const schema = (content as Record<string, unknown>)?.schema;
          if (!schema || typeof schema !== "object") {
            errors.push(
              createError(
                "OAS_INVALID_RESPONSE_STRUCTURE",
                "Subset",
                "Success response must have schema",
                `${opPath}/responses/${code}/content/application~1json`
              )
            );
            continue;
          }

          const schemaPointer = `${opPath}/responses/${code}/content/application~1json/schema`;
          const visited = new Set<string>();
          const err = checkSchemaRecursive(
            doc,
            schema as Record<string, unknown>,
            schemaPointer,
            visited
          );
          if (err) {
            errors.push(err);
          } else {
            // Root success schema must resolve to object or array (CRUD assumes structured data)
            const concrete = resolveSchemaToConcrete(
              doc,
              schema as Record<string, unknown>,
              new Set<string>()
            );
            if (concrete) {
              const primaryType = getPrimaryType(concrete);
              if (
                !primaryType ||
                (primaryType !== "object" && primaryType !== "array")
              ) {
                errors.push(
                  createError(
                    "OAS_INVALID_RESPONSE_STRUCTURE",
                    "Subset",
                    `Root success schema must resolve to object or array; got ${primaryType ?? "unknown"}`,
                    schemaPointer
                  )
                );
              }
            }
          }
        }
      }
    }
  }

  // Zero operations globally → reject
  if (validOpCount === 0) {
    errors.push(
      createError(
        "OAS_INVALID_OPERATION_STRUCTURE",
        "Subset",
        "Document must have at least one valid CRUD operation",
        "/paths"
      )
    );
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }
  return { success: true };
}
