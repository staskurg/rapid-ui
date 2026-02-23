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
import type { ApiIR } from "@/lib/compiler/apiir";
import type { UiPlanIR, ResourcePlan } from "@/lib/compiler/uiplan";
import stringify from "fast-json-stable-stringify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

/** UiPlanIR with paths matching Users schema (id, email, status, profile.*). */
function usersUiPlan(apiIr: ApiIR): UiPlanIR {
  const r = apiIr.resources.find((x) => x.name === "Users");
  if (!r) throw new Error("Users resource not found");
  return {
    resources: [
      {
        name: "Users",
        views: {
          list: {
            fields: [
              { path: "id", label: "ID", order: 0 },
              { path: "email", label: "Email", order: 1 },
              { path: "status", label: "Status", order: 2 },
              { path: "profile.firstName", label: "First Name", order: 3 },
              { path: "profile.lastName", label: "Last Name", order: 4 },
            ],
          },
          detail: {
            fields: [
              { path: "id" },
              { path: "email" },
              { path: "status" },
              { path: "profile.firstName" },
              { path: "profile.lastName" },
            ],
          },
          create: {
            fields: [
              { path: "email" },
              { path: "status" },
              { path: "profile.firstName" },
              { path: "profile.lastName" },
            ],
          },
          edit: {
            fields: [
              { path: "email" },
              { path: "status" },
              { path: "profile.firstName" },
              { path: "profile.lastName" },
            ],
          },
        },
      },
    ],
  };
}

/** UiPlanIR with paths matching Products schema. */
function productsUiPlan(apiIr: ApiIR): UiPlanIR {
  if (!apiIr.resources.some((r) => r.name === "Products")) {
    throw new Error("Products resource not found");
  }
  return {
    resources: [
      {
        name: "Products",
        views: {
          list: {
            fields: [
              { path: "sku", label: "SKU", order: 0 },
              { path: "name", label: "Name", order: 1 },
              { path: "status", label: "Status", order: 2 },
              { path: "price.amount", label: "Price", order: 3 },
              { path: "inventory.quantity", label: "Quantity", order: 4 },
            ],
          },
          detail: {
            fields: [
              { path: "sku" },
              { path: "name" },
              { path: "status" },
              { path: "price.amount" },
              { path: "inventory.quantity" },
            ],
          },
          create: {
            fields: [
              { path: "sku" },
              { path: "name" },
              { path: "status" },
              { path: "price.amount" },
              { path: "price.currency" },
              { path: "inventory.warehouseId" },
              { path: "inventory.quantity" },
            ],
          },
          edit: {
            fields: [
              { path: "name" },
              { path: "status" },
              { path: "price.amount" },
              { path: "inventory.quantity" },
            ],
          },
        },
      },
    ],
  };
}

/** Deterministic mock: maps ApiIR to UiPlanIR for golden specs. */
function mockLlmPlan(apiIr: ApiIR): UiPlanIR {
  const plans: ResourcePlan[] = [];
  for (const r of apiIr.resources) {
    if (r.name === "Users") {
      plans.push(usersUiPlan(apiIr).resources[0]);
    } else if (r.name === "Products") {
      plans.push(productsUiPlan(apiIr).resources[0]);
    } else {
      throw new Error(`Unknown resource: ${r.name}`);
    }
  }
  return { resources: plans };
}

describe("compileOpenAPI full pipeline", () => {
  it("golden Users spec → full compile → UISpec snapshot", async () => {
    const yaml = readFileSync(
      join(FIXTURES, "golden_openapi_users_tagged_3_0.yaml"),
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
      join(FIXTURES, "golden_openapi_products_path_3_1.yaml"),
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
      join(FIXTURES, "golden_openapi_users_tagged_3_0.yaml"),
      "utf-8"
    );
    const r1 = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    const r2 = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(r1.success && r2.success).toBe(true);
    if (!r1.success || !r2.success) return;
    expect(stringify(r1.specs)).toBe(stringify(r2.specs));
    expect(r1.id).toBe(r2.id);
  });
});
