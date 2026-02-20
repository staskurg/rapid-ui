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
});
