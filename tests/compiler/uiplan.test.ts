/**
 * UiPlanIR tests — schema, normalizer, llmPlan with mock.
 * Uses llmPlanFn to avoid real LLM in CI.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { canonicalize } from "@/lib/compiler/openapi/canonicalize";
import { buildApiIR } from "@/lib/compiler/apiir";
import { llmPlan, normalizeUiPlanIR } from "@/lib/compiler/uiplan";
import type { ApiIR, ResourceIR } from "@/lib/compiler/apiir";
import type { UiPlanIR, ResourcePlan } from "@/lib/compiler/uiplan";
import stringify from "fast-json-stable-stringify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function loadApiIr(specPath: string): ApiIR {
  const yaml = readFileSync(join(FIXTURES, specPath), "utf-8");
  const parseResult = parseOpenAPI(yaml);
  if (!parseResult.success) throw new Error(`Parse failed: ${parseResult.error.message}`);
  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) throw new Error(`Validation failed`);
  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) throw new Error(`Ref resolve failed`);
  const doc = canonicalize(resolveResult.doc) as Record<string, unknown>;
  const buildResult = buildApiIR(doc);
  if (!buildResult.success) throw new Error(`Build failed: ${buildResult.error.message}`);
  return buildResult.apiIr;
}

/** Deterministic mock: maps ApiIR to minimal valid UiPlanIR. */
function mockLlmPlan(apiIr: ApiIR): UiPlanIR {
  const resources: ResourcePlan[] = apiIr.resources.map((r: ResourceIR) => {
    const ops = r.operations.map((o) => o.kind);
    const views: ResourcePlan["views"] = {};
    if (ops.includes("list")) views.list = { fields: [{ path: "id" }, { path: "name" }] };
    if (ops.includes("detail")) views.detail = { fields: [{ path: "id" }, { path: "name" }] };
    if (ops.includes("create")) views.create = { fields: [{ path: "name" }] };
    if (ops.includes("update")) views.edit = { fields: [{ path: "name" }] };
    return { name: r.name, views };
  });
  return { resources };
}

describe("UiPlanIR schema and normalizer", () => {
  it("normalizer produces byte-stable output", () => {
    const input: UiPlanIR = {
      resources: [
        {
          name: "Zebra",
          views: {
            list: { fields: [{ path: "b" }, { path: "a" }] },
          },
        },
        {
          name: "Alpha",
          views: {
            list: { fields: [{ path: "id" }] },
          },
        },
      ],
    };
    const out = normalizeUiPlanIR(input);
    expect(out.resources[0].name).toBe("Alpha");
    expect(out.resources[1].name).toBe("Zebra");
    expect(out.resources[1].views.list?.fields[0].path).toBe("a");
    expect(out.resources[1].views.list?.fields[1].path).toBe("b");
    expect(stringify(out)).toMatchSnapshot();
  });

  it("normalizer dedupes fields by path", () => {
    const input: UiPlanIR = {
      resources: [
        {
          name: "R",
          views: {
            list: {
              fields: [
                { path: "id" },
                { path: "id", label: "ID" },
                { path: "name" },
              ],
            },
          },
        },
      ],
    };
    const out = normalizeUiPlanIR(input);
    expect(out.resources[0].views.list?.fields).toHaveLength(2);
    expect(out.resources[0].views.list?.fields.map((f) => f.path)).toEqual(["id", "name"]);
  });

  it("normalizer strips undefined, preserves false and 0", () => {
    const input: UiPlanIR = {
      resources: [
        {
          name: "R",
          views: {
            list: {
              fields: [
                { path: "x", readOnly: false, order: 0 },
              ],
            },
          },
        },
      ],
    };
    const out = normalizeUiPlanIR(input);
    const f = out.resources[0].views.list?.fields[0];
    expect(f?.readOnly).toBe(false);
    expect(f?.order).toBe(0);
  });
});

describe("llmPlan with mock", () => {
  it("golden Users ApiIR → mock UiPlanIR → snapshot", async () => {
    const apiIr = loadApiIr("golden_openapi_users_tagged_3_0.yaml");
    const result = await llmPlan(apiIr, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(stringify(result.uiPlan)).toMatchSnapshot();
    expect(result.uiPlanHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("golden Products ApiIR → mock UiPlanIR → snapshot", async () => {
    const apiIr = loadApiIr("golden_openapi_products_path_3_1.yaml");
    const result = await llmPlan(apiIr, { llmPlanFn: mockLlmPlan });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(stringify(result.uiPlan)).toMatchSnapshot();
  });

  it("same ApiIR → same normalized UiPlanIR (determinism)", async () => {
    const apiIr = loadApiIr("golden_openapi_users_tagged_3_0.yaml");
    const r1 = await llmPlan(apiIr, { llmPlanFn: mockLlmPlan });
    const r2 = await llmPlan(apiIr, { llmPlanFn: mockLlmPlan });
    expect(r1.success && r2.success).toBe(true);
    if (!r1.success || !r2.success) return;
    expect(stringify(r1.uiPlan)).toBe(stringify(r2.uiPlan));
    expect(r1.uiPlanHash).toBe(r2.uiPlanHash);
  });

  it("returns UIPLAN_LLM_UNAVAILABLE when no API key and no mock", async () => {
    const apiIr = loadApiIr("golden_openapi_users_tagged_3_0.yaml");
    const orig = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await llmPlan(apiIr);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.code).toBe("UIPLAN_LLM_UNAVAILABLE");
    } finally {
      if (orig !== undefined) process.env.OPENAI_API_KEY = orig;
    }
  });
});
