import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

describe("invalid spec", () => {
  it("golden_openapi_invalid_expected_failure.yaml fails with expected errors", () => {
    const yaml = readFileSync(
      join(FIXTURES, "golden_openapi_invalid_expected_failure.yaml"),
      "utf-8"
    );
    const parseResult = parseOpenAPI(yaml);
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;

    const validateResult = validateSubset(parseResult.doc);
    expect(validateResult.success).toBe(false);
    if (validateResult.success) return;

    const codes = validateResult.errors.map((e) => e.code);
    expect(codes).toContain("OAS_MULTIPLE_TAGS");
    expect(codes).toContain("OAS_MULTIPLE_SUCCESS_RESPONSES");
    expect(codes).toContain("OAS_MULTIPLE_PATH_PARAMS");
    expect(codes).toContain("OAS_UNSUPPORTED_SCHEMA_KEYWORD");
  });

  it("same invalid spec produces same ordered error list", () => {
    const yaml = readFileSync(
      join(FIXTURES, "golden_openapi_invalid_expected_failure.yaml"),
      "utf-8"
    );
    const parse1 = parseOpenAPI(yaml);
    const parse2 = parseOpenAPI(yaml);
    expect(parse1.success && parse2.success).toBe(true);
    if (!parse1.success || !parse2.success) return;

    const v1 = validateSubset(parse1.doc);
    const v2 = validateSubset(parse2.doc);
    expect(v1.success).toBe(false);
    expect(v2.success).toBe(false);
    if (v1.success || v2.success) return;

    expect(v1.errors.map((e) => e.code)).toEqual(v2.errors.map((e) => e.code));
    expect(v1.errors.map((e) => e.message)).toEqual(v2.errors.map((e) => e.message));
  });
});
