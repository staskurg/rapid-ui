/**
 * Capability derivation tests — Phase 1.1.
 * deriveCapabilitiesForResource, deriveCapabilities, pipeline embedding.
 */

import { describe, it, expect } from "vitest";
import {
  deriveCapabilitiesForResource,
  deriveCapabilities,
  buildApiIR,
} from "@/lib/compiler/apiir";
import type { ResourceIR, OperationIR, ApiIR } from "@/lib/compiler/apiir";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { compileOpenAPI } from "@/lib/compiler/pipeline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function makeResourceWithOps(operations: OperationIR[]): ResourceIR {
  return {
    name: "Items",
    key: "items",
    operations,
  };
}

describe("deriveCapabilitiesForResource", () => {
  it("GET /items (list) + POST /items (create) → list:true, detail:false, create:true, update:false, delete:false", () => {
    const resource = makeResourceWithOps([
      {
        id: "listItems",
        method: "GET",
        kind: "list",
        path: "/items",
        responseSchema: { type: "array", items: { type: "object" } },
      },
      {
        id: "createItem",
        method: "POST",
        kind: "create",
        path: "/items",
        requestSchema: { type: "object" },
        responseSchema: { type: "object" },
      },
    ]);
    const caps = deriveCapabilitiesForResource(resource);
    expect(caps).toEqual({
      list: true,
      detail: false,
      create: true,
      update: false,
      delete: false,
    });
  });

  it("full CRUD → all capabilities true", () => {
    const resource = makeResourceWithOps([
      { id: "l", method: "GET", kind: "list", path: "/x", responseSchema: {} },
      { id: "d", method: "GET", kind: "detail", path: "/x/{id}", identifierParam: "id", responseSchema: {} },
      { id: "c", method: "POST", kind: "create", path: "/x", requestSchema: {}, responseSchema: {} },
      { id: "u", method: "PUT", kind: "update", path: "/x/{id}", identifierParam: "id", requestSchema: {}, responseSchema: {} },
      { id: "del", method: "DELETE", kind: "delete", path: "/x/{id}", identifierParam: "id", responseSchema: {} },
    ]);
    const caps = deriveCapabilitiesForResource(resource);
    expect(caps).toEqual({
      list: true,
      detail: true,
      create: true,
      update: true,
      delete: true,
    });
  });

  it("list-only → only list true", () => {
    const resource = makeResourceWithOps([
      { id: "l", method: "GET", kind: "list", path: "/x", responseSchema: {} },
    ]);
    const caps = deriveCapabilitiesForResource(resource);
    expect(caps).toEqual({
      list: true,
      detail: false,
      create: false,
      update: false,
      delete: false,
    });
  });
});

describe("deriveCapabilities + pipeline", () => {
  it("deriveCapabilities embeds capabilities in apiIr.resources[].capabilities", () => {
    const yaml = readFileSync(
      join(FIXTURES, "demo", "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const parseResult = parseOpenAPI(yaml);
    if (!parseResult.success) throw new Error("Parse failed");
    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) throw new Error("Validate failed");
    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) throw new Error("Resolve failed");
    const buildResult = buildApiIR(resolveResult.doc);
    if (!buildResult.success) throw new Error("Build failed");

    const apiIr: ApiIR = buildResult.apiIr;
    expect(apiIr.resources[0].capabilities).toBeUndefined();

    deriveCapabilities(apiIr);

    const users = apiIr.resources.find((r) => r.name === "Users");
    expect(users).toBeDefined();
    expect(users!.capabilities).toBeDefined();
    expect(users!.capabilities!.list).toBe(true);
    expect(users!.capabilities!.detail).toBe(true);
    expect(users!.capabilities!.create).toBe(true);
    expect(users!.capabilities!.update).toBe(true);
    expect(users!.capabilities!.delete).toBe(true);
  });

  it("compileOpenAPI embeds capabilities and lower receives capabilitiesBySlug", async () => {
    const yaml = readFileSync(
      join(FIXTURES, "demo", "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const result = await compileOpenAPI(yaml, {
      llmPlanFn: (apiIr) => ({
        resources: apiIr.resources.map((r) => ({
          name: r.name,
          views: {
            list: { fields: [{ path: "id" }, { path: "email" }] },
            detail: { fields: [{ path: "id" }, { path: "email" }] },
            create: { fields: [{ path: "email" }] },
            edit: { fields: [{ path: "email" }] },
          },
        })),
      }),
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.apiIr.resources[0].capabilities).toBeDefined();
    expect(result.apiIr.resources[0].capabilities!.list).toBe(true);
    expect(result.specs.users).toBeDefined();
  });
});
