/**
 * RUS-v1 check script tests: parse → validateSubset → resolveRefs → buildApiIR.
 * Golden specs → VALID; invalid specs → INVALID with expected codes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { buildApiIR } from "@/lib/compiler/apiir";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function checkOpenAPI(content: string): { valid: boolean; errors?: { code: string; message: string; jsonPointer?: string }[] } {
  const parseResult = parseOpenAPI(content);
  if (!parseResult.success) {
    return { valid: false, errors: [parseResult.error] };
  }

  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) {
    return { valid: false, errors: validateResult.errors };
  }

  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) {
    return { valid: false, errors: [resolveResult.error] };
  }

  const buildResult = buildApiIR(resolveResult.doc);
  if (!buildResult.success) {
    return { valid: false, errors: [buildResult.error] };
  }

  return { valid: true };
}

describe("check-openapi (parse → validateSubset → resolveRefs → buildApiIR)", () => {
  it("golden_openapi_users_tagged_3_0.yaml → VALID", () => {
    const yaml = readFileSync(join(FIXTURES, "golden_openapi_users_tagged_3_0.yaml"), "utf-8");
    const result = checkOpenAPI(yaml);
    expect(result.valid).toBe(true);
  });

  it("golden_openapi_products_path_3_1.yaml → VALID", () => {
    const yaml = readFileSync(join(FIXTURES, "golden_openapi_products_path_3_1.yaml"), "utf-8");
    const result = checkOpenAPI(yaml);
    expect(result.valid).toBe(true);
  });

  it("golden_openapi_invalid_expected_failure.yaml → INVALID with expected codes", () => {
    const yaml = readFileSync(join(FIXTURES, "golden_openapi_invalid_expected_failure.yaml"), "utf-8");
    const result = checkOpenAPI(yaml);
    expect(result.valid).toBe(false);
    if (result.valid || !result.errors) return;

    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain("OAS_MULTIPLE_TAGS");
    expect(codes).toContain("OAS_MISSING_REQUEST_BODY");
    expect(codes).toContain("OAS_MULTIPLE_PATH_PARAMS");
    expect(codes).toContain("OAS_UNSUPPORTED_SCHEMA_KEYWORD");
  });

  it("golden_openapi_invalid_mixed_grouping_expected_failure.yaml → INVALID with OAS_AMBIGUOUS_RESOURCE_GROUPING", () => {
    const yaml = readFileSync(join(FIXTURES, "golden_openapi_invalid_mixed_grouping_expected_failure.yaml"), "utf-8");
    const result = checkOpenAPI(yaml);
    expect(result.valid).toBe(false);
    if (result.valid || !result.errors) return;

    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain("OAS_AMBIGUOUS_RESOURCE_GROUPING");
  });

  it("golden_openapi_invalid_non_crud_expected_failure.yaml → INVALID with IR_INVALID (non-CRUD operation)", () => {
    const yaml = readFileSync(join(FIXTURES, "golden_openapi_invalid_non_crud_expected_failure.yaml"), "utf-8");
    const result = checkOpenAPI(yaml);
    expect(result.valid).toBe(false);
    if (result.valid || !result.errors) return;

    expect(result.errors[0].code).toBe("IR_INVALID");
    expect(result.errors[0].message).toContain("Non-CRUD operation");
    expect(result.errors[0].message).toContain("POST");
    expect(result.errors[0].message).toContain("path params");
  });

  it("corpus-valid-v1 fixtures → all VALID (RUS-v1 compliant from APIs.guru corpus)", () => {
    const corpusDir = join(FIXTURES, "corpus-valid-v1");
    if (!existsSync(corpusDir)) {
      return; // skip if corpus fixtures not yet extracted
    }
    const files = readdirSync(corpusDir).filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json")
    );
    const failures: string[] = [];
    for (const file of files) {
      const content = readFileSync(join(corpusDir, file), "utf-8");
      const result = checkOpenAPI(content);
      if (!result.valid) {
        const msg = result.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ?? "unknown";
        failures.push(`${file}: ${msg}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
