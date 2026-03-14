/**
 * Identity fields derivation tests.
 * deriveIdentityFields: detail/update/delete ops → identityFields; create-only → [].
 */

import { describe, it, expect } from "vitest";
import {
  buildApiIR,
  deriveCapabilities,
  deriveIdentityFields,
} from "@/lib/compiler/apiir";
import { compileOpenAPI } from "@/lib/compiler/pipeline";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function loadAndBuild(specPath: string) {
  const yaml = readFileSync(join(FIXTURES, specPath), "utf-8");
  const parseResult = parseOpenAPI(yaml);
  if (!parseResult.success) throw new Error("Parse failed");
  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) throw new Error("Validate failed");
  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) throw new Error("Resolve failed");
  const buildResult = buildApiIR(resolveResult.doc);
  if (!buildResult.success) throw new Error("Build failed");
  return buildResult.apiIr;
}

describe("deriveIdentityFields", () => {
  it("GET /items/{id} (detail) → identityFields = [\"id\"]", () => {
    const apiIr = loadAndBuild("capability-specs/detail-only-spec.yaml");
    deriveCapabilities(apiIr);
    const result = deriveIdentityFields(apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const resource = apiIr.resources[0];
    expect(resource!.identityFields).toEqual(["id"]);
  });

  it("create-only (POST only) → identityFields = []", () => {
    const apiIr = loadAndBuild("capability-specs/create-only-spec.yaml");
    deriveCapabilities(apiIr);
    const result = deriveIdentityFields(apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const resource = apiIr.resources[0];
    expect(resource!.identityFields).toEqual([]);
  });

  it("full CRUD Users (userId) → identityFields = [\"userId\"]", () => {
    const apiIr = loadAndBuild("demo/golden_openapi_users_tagged_3_0.yaml");
    deriveCapabilities(apiIr);
    const result = deriveIdentityFields(apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const users = apiIr.resources.find((r) => r.name === "Users");
    expect(users!.identityFields).toEqual(["userId"]);
  });

  it("detail-update (id) → identityFields = [\"id\"]", () => {
    const apiIr = loadAndBuild("capability-specs/detail-update-spec.yaml");
    deriveCapabilities(apiIr);
    const result = deriveIdentityFields(apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const resource = apiIr.resources[0];
    expect(resource!.identityFields).toEqual(["id"]);
  });

  it("create-update (id) → identityFields = [\"id\"]", () => {
    const apiIr = loadAndBuild("capability-specs/create-update-spec.yaml");
    deriveCapabilities(apiIr);
    const result = deriveIdentityFields(apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const resource = apiIr.resources[0];
    expect(resource!.identityFields).toEqual(["id"]);
  });

  it("list-only → identityFields = []", () => {
    const apiIr = loadAndBuild("capability-specs/list-only-spec.yaml");
    deriveCapabilities(apiIr);
    const result = deriveIdentityFields(apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const resource = apiIr.resources[0];
    expect(resource!.identityFields).toEqual([]);
  });

  it("multi-param (different identifierParam across ops) → compile error", () => {
    const apiIr: import("@/lib/compiler/apiir").ApiIR = {
      api: { title: "Test", version: "1.0" },
      resources: [
        {
          name: "Items",
          key: "items",
          operations: [
            {
              id: "getById",
              method: "GET",
              kind: "detail",
              path: "/items/{userId}",
              identifierParam: "userId",
              responseSchema: { type: "object" },
            },
            {
              id: "updateById",
              method: "PATCH",
              kind: "update",
              path: "/items/{id}",
              identifierParam: "id",
              requestSchema: { type: "object" },
              responseSchema: { type: "object" },
            },
          ],
        },
      ],
    };
    deriveCapabilities(apiIr);
    const result = deriveIdentityFields(apiIr);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("IR_INVALID");
    expect(result.error.message).toContain("Multi-param");
    expect(result.error.message).toContain("userId");
    expect(result.error.message).toContain("id");
  });

  it("compileOpenAPI fails for multi-param identity spec", async () => {
    const yaml = readFileSync(
      join(FIXTURES, "invalid", "golden_openapi_invalid_multi_param_identity_expected_failure.yaml"),
      "utf-8"
    );
    const result = await compileOpenAPI(yaml, {
      llmPlanFn: (apiIr) => ({
        resources: apiIr.resources.map((r) => ({
          name: r.name,
          views: {
            list: { fields: [{ path: "id" }] },
            detail: { fields: [{ path: "id" }] },
            create: { fields: [{ path: "id" }] },
            edit: { fields: [{ path: "id" }] },
          },
        })),
      }),
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain("IR_INVALID");
    expect(result.errors.some((e) => e.message.includes("Multi-param"))).toBe(true);
  });
});
