/**
 * OpenAPI parser tests: version rejection and valid 3.x parsing.
 * Phase 0 checkpoint: reject 2.x, 1.x, missing, malformed; accept 3.0.x and 3.1.x.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

const OPENAPI_2_0 = `
swagger: "2.0"
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      responses:
        "200":
          description: OK
`;

const OPENAPI_1_0 = `
swagger: "1.0"
info:
  title: Test API
paths:
  /users:
    get:
      summary: List users
`;

const OPENAPI_3_0_MINIMAL = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      responses:
        "200":
          description: OK
`;

const OPENAPI_3_1_MINIMAL = `
openapi: 3.1.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      responses:
        "200":
          description: OK
`;

describe("parseOpenAPI version rejection", () => {
  it("rejects OpenAPI 2.0 with OAS_UNSUPPORTED_VERSION", () => {
    const result = parseOpenAPI(OPENAPI_2_0);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_UNSUPPORTED_VERSION");
    expect(result.error.stage).toBe("Parse");
  });

  it("rejects OpenAPI 1.0 with OAS_UNSUPPORTED_VERSION", () => {
    const result = parseOpenAPI(OPENAPI_1_0);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_UNSUPPORTED_VERSION");
    expect(result.error.stage).toBe("Parse");
  });

  it("rejects missing openapi field with OAS_UNSUPPORTED_VERSION", () => {
    const yaml = `
info:
  title: Test API
paths: {}
`;
    const result = parseOpenAPI(yaml);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_UNSUPPORTED_VERSION");
    expect(result.error.message).toContain("Missing");
  });

  it("rejects malformed openapi (non-string) with OAS_UNSUPPORTED_VERSION", () => {
    const yaml = `
openapi: 3
info:
  title: Test API
paths: {}
`;
    const result = parseOpenAPI(yaml);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_UNSUPPORTED_VERSION");
  });

  it("rejects unsupported version string with OAS_UNSUPPORTED_VERSION", () => {
    const yaml = `
openapi: "4.0.0"
info:
  title: Test API
paths: {}
`;
    const result = parseOpenAPI(yaml);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("OAS_UNSUPPORTED_VERSION");
    expect(result.error.message).toContain("Only 3.0.x and 3.1.x");
  });
});

describe("parseOpenAPI valid 3.x", () => {
  it("accepts OpenAPI 3.0.x and parses successfully", () => {
    const result = parseOpenAPI(OPENAPI_3_0_MINIMAL);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.version).toBe("3.0");
    expect(result.doc.openapi).toBe("3.0.3");
  });

  it("accepts OpenAPI 3.1.x and parses successfully", () => {
    const result = parseOpenAPI(OPENAPI_3_1_MINIMAL);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.version).toBe("3.1");
    expect(result.doc.openapi).toBe("3.1.0");
  });

  it("accepts golden 3.0 spec and parses successfully", () => {
    const yaml = readFileSync(
      join(FIXTURES, "demo", "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const result = parseOpenAPI(yaml);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.version).toBe("3.0");
  });

  it("accepts golden 3.1 spec and parses successfully", () => {
    const yaml = readFileSync(
      join(FIXTURES, "demo", "golden_openapi_products_path_3_1.yaml"),
      "utf-8"
    );
    const result = parseOpenAPI(yaml);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.version).toBe("3.1");
  });
});
