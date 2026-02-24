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

/** UiPlanIR with paths matching Users schema (golden + demo v1/v2/v3). */
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
              { path: "role", label: "Role", order: 5 },
              { path: "department", label: "Department", order: 6 },
              { path: "lastLoginAt", label: "Last Login", order: 7 },
              { path: "notes", label: "Notes", order: 8 },
            ],
          },
          detail: {
            fields: [
              { path: "id" },
              { path: "email" },
              { path: "status" },
              { path: "profile.firstName" },
              { path: "profile.lastName" },
              { path: "role" },
              { path: "department" },
              { path: "lastLoginAt" },
              { path: "notes" },
            ],
          },
          create: {
            fields: [
              { path: "email" },
              { path: "status" },
              { path: "profile.firstName" },
              { path: "profile.lastName" },
              { path: "role" },
              { path: "department" },
              { path: "notes" },
            ],
          },
          edit: {
            fields: [
              { path: "email" },
              { path: "status" },
              { path: "profile.firstName" },
              { path: "profile.lastName" },
              { path: "role" },
              { path: "department" },
              { path: "notes" },
            ],
          },
        },
      },
    ],
  };
}

/** UiPlanIR with paths matching Tasks schema (v2: assigneeId, dueDate; v3: dueAt, tags). */
function tasksUiPlan(apiIr: ApiIR): UiPlanIR {
  const r = apiIr.resources.find((x) => x.name === "Tasks");
  if (!r) throw new Error("Tasks resource not found");
  return {
    resources: [
      {
        name: "Tasks",
        views: {
          list: {
            fields: [
              { path: "id", label: "ID", order: 0 },
              { path: "title", label: "Title", order: 1 },
              { path: "status", label: "Status", order: 2 },
              { path: "assigneeId", label: "Assignee", order: 3 },
              { path: "dueDate", label: "Due Date", order: 4 },
              { path: "dueAt", label: "Due At", order: 4 },
              { path: "priority", label: "Priority", order: 5 },
              { path: "tags", label: "Tags", order: 6 },
            ],
          },
          detail: {
            fields: [
              { path: "id" },
              { path: "title" },
              { path: "status" },
              { path: "assigneeId" },
              { path: "dueDate" },
              { path: "dueAt" },
              { path: "priority" },
              { path: "tags" },
            ],
          },
          create: {
            fields: [
              { path: "title" },
              { path: "status" },
              { path: "assigneeId" },
              { path: "dueDate" },
              { path: "dueAt" },
              { path: "priority" },
              { path: "tags" },
            ],
          },
          edit: {
            fields: [
              { path: "title" },
              { path: "status" },
              { path: "assigneeId" },
              { path: "dueDate" },
              { path: "dueAt" },
              { path: "priority" },
              { path: "tags" },
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

/** Deterministic mock: maps ApiIR to UiPlanIR for golden and demo specs. */
function mockLlmPlan(apiIr: ApiIR): UiPlanIR {
  const plans: ResourcePlan[] = [];
  for (const r of apiIr.resources) {
    if (r.name === "Users") {
      plans.push(usersUiPlan(apiIr).resources[0]);
    } else if (r.name === "Products") {
      plans.push(productsUiPlan(apiIr).resources[0]);
    } else if (r.name === "Tasks") {
      plans.push(tasksUiPlan(apiIr).resources[0]);
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
    // ids differ (UUID-based); specs comparison is the determinism check
  });

  it("demo v1 → Users only", async () => {
    const yaml = readFileSync(join(FIXTURES, "demo_users_tasks_v1.yaml"), "utf-8");
    const result = await compileOpenAPI(yaml, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.users).toBeDefined();
    expect(result.resourceNames).toEqual(["Users"]);
    expect(result.resourceSlugs).toContain("users");
  });

  it("demo v2 → Users + Tasks", async () => {
    const yaml = readFileSync(join(FIXTURES, "demo_users_tasks_v2.yaml"), "utf-8");
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
    const yaml = readFileSync(join(FIXTURES, "demo_users_tasks_v3.yaml"), "utf-8");
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
