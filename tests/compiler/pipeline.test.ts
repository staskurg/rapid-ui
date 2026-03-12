/**
 * Full pipeline E2E: OpenAPI → UISpec.
 * Uses llmPlanFn to avoid real LLM (no OPENAI_API_KEY required).
 * Evals cover determinism with real LLM.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { compileOpenAPI } from "@/lib/compiler/pipeline";
import { getResourcePathSet } from "@/lib/compiler/lowering/schema-to-field";
import type { ApiIR } from "@/lib/compiler/apiir";
import type { UiPlanIR, ResourcePlan } from "@/lib/compiler/uiplan";
import type { ResourceIR } from "@/lib/compiler/apiir";
import stringify from "fast-json-stable-stringify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

/** Build UiPlanIR from ApiIR using only valid schema paths. Deterministic per resource. */
function buildUiPlanFromSchema(apiIr: ApiIR): UiPlanIR {
  const resources: ResourcePlan[] = apiIr.resources.map((r: ResourceIR) => {
    const paths = [...getResourcePathSet(r)].filter((p) => !p.startsWith("$")).sort();
    const listPaths = paths.slice(0, 5).map((path, i) => ({ path, label: path, order: i }));
    const detailPaths = paths.slice(0, 5).map((path) => ({ path }));
    const createPaths = paths.slice(0, 4).map((path) => ({ path }));
    const editPaths = paths.slice(0, 4).map((path) => ({ path }));

    const ops = r.operations.map((o) => o.kind);
    const views: ResourcePlan["views"] = {};
    if (ops.includes("list") && listPaths.length) views.list = { fields: listPaths };
    if (ops.includes("detail") && detailPaths.length) views.detail = { fields: detailPaths };
    if (ops.includes("create") && createPaths.length) views.create = { fields: createPaths };
    if (ops.includes("update") && editPaths.length) views.edit = { fields: editPaths };

    return { name: r.name, views };
  });
  return { resources };
}

/** Deterministic mock: maps ApiIR to UiPlanIR using only valid schema paths. */
function mockLlmPlan(apiIr: ApiIR): UiPlanIR {
  return buildUiPlanFromSchema(apiIr);
}

describe("compileOpenAPI full pipeline", () => {
  it("golden Users spec → full compile → UISpec snapshot", async () => {
    const yaml = readFileSync(
      join(FIXTURES, "demo", "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const result = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.users).toBeDefined();
    expect(result.resourceNames).toContain("Users");
    expect(result.resourceSlugs).toContain("users");
    expect(stringify(result.specs)).toMatchSnapshot();
  });

  it("golden Products spec → full compile → UISpec snapshot", async () => {
    const yaml = readFileSync(
      join(FIXTURES, "demo", "golden_openapi_products_path_3_1.yaml"),
      "utf-8"
    );
    const result = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.products).toBeDefined();
    expect(result.resourceNames).toContain("Products");
    expect(result.resourceSlugs).toContain("products");
    expect(stringify(result.specs)).toMatchSnapshot();
  });

  it("same OpenAPI → same UISpec (determinism)", async () => {
    const yaml = readFileSync(
      join(FIXTURES, "demo", "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const r1 = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    const r2 = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(r1.success && r2.success).toBe(true);
    if (!r1.success || !r2.success) return;
    expect(stringify(r1.specs)).toBe(stringify(r2.specs));
    // ids differ (UUID-based); specs comparison is the determinism check
  });

  it("demo v1 → Users only", async () => {
    const yaml = readFileSync(join(FIXTURES, "demo", "demo_users_tasks_v1.yaml"), "utf-8");
    const result = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.users).toBeDefined();
    expect(result.resourceNames).toEqual(["Users"]);
    expect(result.resourceSlugs).toContain("users");
  });

  it("demo v2 → Users + Tasks", async () => {
    const yaml = readFileSync(join(FIXTURES, "demo", "demo_users_tasks_v2.yaml"), "utf-8");
    const result = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.users).toBeDefined();
    expect(result.specs.tasks).toBeDefined();
    expect(result.resourceNames).toContain("Users");
    expect(result.resourceNames).toContain("Tasks");
    expect(result.resourceSlugs).toContain("users");
    expect(result.resourceSlugs).toContain("tasks");
  });

  it("demo v3 → Users + Tasks with updated fields", async () => {
    const yaml = readFileSync(join(FIXTURES, "demo", "demo_users_tasks_v3.yaml"), "utf-8");
    const result = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.users).toBeDefined();
    expect(result.specs.tasks).toBeDefined();
    expect(result.resourceNames).toContain("Users");
    expect(result.resourceNames).toContain("Tasks");
    expect(result.resourceSlugs).toContain("users");
    expect(result.resourceSlugs).toContain("tasks");
  });
});
