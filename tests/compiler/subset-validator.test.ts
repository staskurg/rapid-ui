import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

describe("subset validator", () => {
  it("golden_openapi_users_tagged_3_0.yaml passes validation", () => {
    const yaml = readFileSync(
      join(FIXTURES, "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const parseResult = parseOpenAPI(yaml);
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;

    const validateResult = validateSubset(parseResult.doc);
    expect(validateResult.success).toBe(true);
  });

  it("golden_openapi_products_path_3_1.yaml passes validation", () => {
    const yaml = readFileSync(
      join(FIXTURES, "golden_openapi_products_path_3_1.yaml"),
      "utf-8"
    );
    const parseResult = parseOpenAPI(yaml);
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;

    const validateResult = validateSubset(parseResult.doc);
    expect(validateResult.success).toBe(true);
  });

  it("rejects unsupported schema keyword (example)", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string", example: "x" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_UNSUPPORTED_SCHEMA_KEYWORD")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("example"))).toBe(true);
  });

  it("rejects additionalProperties: true", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      additionalProperties: true,
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_SCHEMA_SHAPE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("additionalProperties"))).toBe(true);
  });

  it("rejects required referencing non-existent property", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["id", "missing"],
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_SCHEMA_SHAPE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("non-existent"))).toBe(true);
  });

  it("rejects empty paths", () => {
    const doc = { openapi: "3.0.0", paths: {} } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_OPERATION_STRUCTURE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("paths must not be empty"))).toBe(true);
  });

  it("rejects path with no supported methods", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/webhooks": { options: { summary: "CORS" } },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_OPERATION_STRUCTURE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("at least one supported"))).toBe(true);
  });

  it("rejects path-level parameters", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          parameters: [{ name: "x", in: "query", schema: { type: "string" } }],
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_OPERATION_STRUCTURE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("operation level"))).toBe(true);
  });

  it("rejects POST with requestBody content but missing schema", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          post: {
            requestBody: {
              content: {
                "application/json": {},
              },
            },
            responses: {
              "201": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_OPERATION_STRUCTURE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("must have schema"))).toBe(true);
  });

  it("rejects GET with requestBody", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { id: { type: "string" } },
                  },
                },
              },
            },
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_OPERATION_STRUCTURE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("must not have requestBody"))).toBe(true);
  });

  it("rejects operation with missing success response", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            responses: {
              "404": { description: "Not found" },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_OPERATION_STRUCTURE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("exactly one success"))).toBe(true);
  });

  it("rejects path param with non-primitive schema", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items/{id}": {
          get: {
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: {
                  type: "object",
                  properties: { value: { type: "string" } },
                },
              },
            ],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_PARAMETER")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("string or integer"))).toBe(true);
  });

  it("rejects query param with oneOf", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            parameters: [
              {
                name: "filter",
                in: "query",
                schema: {
                  oneOf: [
                    { type: "string" },
                    { type: "integer" },
                  ],
                },
              },
            ],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_UNSUPPORTED_SCHEMA_KEYWORD")).toBe(true);
  });

  it("rejects root success schema with primitive type (string)", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_RESPONSE_STRUCTURE")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("object or array"))).toBe(true);
  });

  it("rejects query param with $ref to object schema", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            parameters: [
              {
                name: "filter",
                in: "query",
                schema: { $ref: "#/components/schemas/FilterObject" },
              },
            ],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          FilterObject: {
            type: "object",
            properties: { field: { type: "string" } },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === "OAS_INVALID_PARAMETER")).toBe(true);
    expect(result.errors.some((e) => e.message.includes("primitive"))).toBe(true);
  });
});
