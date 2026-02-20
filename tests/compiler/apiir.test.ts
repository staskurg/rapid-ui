import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { canonicalize } from "@/lib/compiler/openapi/canonicalize";
import { buildApiIR, apiIrStringify } from "@/lib/compiler/apiir/build";
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
  return canonicalize(resolveResult.doc) as Record<string, unknown>;
}

describe("ApiIR build", () => {
  it("golden_openapi_users_tagged_3_0.yaml produces expected ApiIR", () => {
    const doc = loadAndProcess("golden_openapi_users_tagged_3_0.yaml");
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const str = apiIrStringify(result.apiIr);
    expect(str).toMatchSnapshot();
  });

  it("golden_openapi_products_path_3_1.yaml produces expected ApiIR", () => {
    const doc = loadAndProcess("golden_openapi_products_path_3_1.yaml");
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const str = apiIrStringify(result.apiIr);
    expect(str).toMatchSnapshot();
  });

  it("ApiIR JSON is byte-stable (same input → same output)", () => {
    const doc = loadAndProcess("golden_openapi_users_tagged_3_0.yaml");
    const r1 = buildApiIR(doc);
    const r2 = buildApiIR(doc);
    expect(r1.success && r2.success).toBe(true);
    if (!r1.success || !r2.success) return;
    expect(apiIrStringify(r1.apiIr)).toBe(apiIrStringify(r2.apiIr));
    expect(r1.apiIrHash).toBe(r2.apiIrHash);
  });

  it("same ApiIR produces same hash", () => {
    const doc = loadAndProcess("golden_openapi_users_tagged_3_0.yaml");
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const hash1 = sha256Hash(result.apiIr);
    const hash2 = result.apiIrHash;
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different specs produce different ApiIR and hashes", () => {
    const usersDoc = loadAndProcess("golden_openapi_users_tagged_3_0.yaml");
    const productsDoc = loadAndProcess("golden_openapi_products_path_3_1.yaml");
    const usersResult = buildApiIR(usersDoc);
    const productsResult = buildApiIR(productsDoc);
    expect(usersResult.success && productsResult.success).toBe(true);
    if (!usersResult.success || !productsResult.success) return;
    expect(usersResult.apiIrHash).not.toBe(productsResult.apiIrHash);
    expect(apiIrStringify(usersResult.apiIr)).not.toBe(apiIrStringify(productsResult.apiIr));
  });

  it("fails when no paths", () => {
    const doc = {
      openapi: "3.0.0",
      info: { title: "Empty", version: "1.0" },
      paths: {},
    } as Record<string, unknown>;
    const result = buildApiIR(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_AMBIGUOUS_RESOURCE_GROUPING");
  });

  it("fails when paths is missing", () => {
    const doc = {
      openapi: "3.0.0",
      info: { title: "No Paths", version: "1.0" },
    } as Record<string, unknown>;
    const result = buildApiIR(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("IR_INVALID");
  });
});
