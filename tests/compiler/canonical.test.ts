import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { canonicalize, canonicalStringify } from "@/lib/compiler/openapi/canonicalize";
import { sha256Hash } from "@/lib/compiler/hash";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function loadAndProcess(specPath: string) {
  const yaml = readFileSync(join(FIXTURES, specPath), "utf-8");
  const parseResult = parseOpenAPI(yaml);
  if (!parseResult.success) throw new Error(`Parse failed: ${parseResult.error.message}`);
  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) throw new Error(`Validation failed`);
  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) throw new Error(`Ref resolve failed: ${resolveResult.error.message}`);
  return resolveResult.doc;
}

describe("canonicalization and hashing", () => {
  it("golden_openapi_users_tagged_3_0.yaml produces stable canonical JSON", () => {
    const doc = loadAndProcess("golden_openapi_users_tagged_3_0.yaml");
    const str = canonicalStringify(doc);

    expect(str).toMatchSnapshot();
  });

  it("golden_openapi_products_path_3_1.yaml produces stable canonical JSON", () => {
    const doc = loadAndProcess("golden_openapi_products_path_3_1.yaml");
    const str = canonicalStringify(doc);

    expect(str).toMatchSnapshot();
  });

  it("same spec with reordered keys produces same canonical JSON", () => {
    const yaml = readFileSync(
      join(FIXTURES, "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const parse1 = parseOpenAPI(yaml);
    const parse2 = parseOpenAPI(yaml);
    expect(parse1.success && parse2.success).toBe(true);
    if (!parse1.success || !parse2.success) return;

    const validate1 = validateSubset(parse1.doc);
    const validate2 = validateSubset(parse2.doc);
    expect(validate1.success && validate2.success).toBe(true);
    if (!validate1.success || !validate2.success) return;

    const resolve1 = resolveRefs(parse1.doc);
    const resolve2 = resolveRefs(parse2.doc);
    expect(resolve1.success && resolve2.success).toBe(true);
    if (!resolve1.success || !resolve2.success) return;

    const str1 = canonicalStringify(resolve1.doc);
    const str2 = canonicalStringify(resolve2.doc);
    expect(str1).toBe(str2);
  });

  it("JSON with different key order produces same canonical output", () => {
    const specA = {
      openapi: "3.0",
      info: { title: "T", version: "1" },
      paths: {
        "/x": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { type: "object", properties: { id: { type: "string" } } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const specB = {
      paths: {
        "/x": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { properties: { id: { type: "string" } }, type: "object" },
                  },
                },
              },
            },
          },
        },
      },
      info: { version: "1", title: "T" },
      openapi: "3.0",
    };
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;

    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;

    const strA = canonicalStringify(resolveA.doc);
    const strB = canonicalStringify(resolveB.doc);
    expect(strA).toBe(strB);
  });

  it("same canonical JSON produces same hash", () => {
    const doc = loadAndProcess("golden_openapi_users_tagged_3_0.yaml");
    const canonical = canonicalize(doc);
    const hash1 = sha256Hash(canonical);
    const hash2 = sha256Hash(canonical);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different specs produce different hashes", () => {
    const usersDoc = loadAndProcess("golden_openapi_users_tagged_3_0.yaml");
    const productsDoc = loadAndProcess("golden_openapi_products_path_3_1.yaml");
    const usersCanonical = canonicalize(usersDoc);
    const productsCanonical = canonicalize(productsDoc);
    const usersHash = sha256Hash(usersCanonical);
    const productsHash = sha256Hash(productsCanonical);
    expect(usersHash).not.toBe(productsHash);
  });

  it("rejects circular $ref", () => {
    const doc = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0" },
      paths: {},
      components: {
        schemas: {
          A: { type: "object", properties: { b: { $ref: "#/components/schemas/B" } } },
          B: { type: "object", properties: { a: { $ref: "#/components/schemas/A" } } },
        },
      },
    } as Record<string, unknown>;
    const result = resolveRefs(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_CIRCULAR_REF");
  });

  it("rejects external $ref", () => {
    const doc = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0" },
      paths: {
        "/users": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { $ref: "https://example.com/schema.json" },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = resolveRefs(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_EXTERNAL_REF");
  });
});
