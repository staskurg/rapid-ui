/**
 * Comparator tests — Phase 1.4.
 * extractFingerprint tolerates missing optional sections (table, form, filters, detail).
 */

import { describe, it, expect } from "vitest";
import {
  extractFingerprint,
  compareSpecsMulti,
} from "@/eval/utils/comparator";
import type { UISpec } from "@/lib/spec/types";

const minimalFields = [
  { name: "id", label: "ID", type: "string" as const, required: true },
  { name: "name", label: "Name", type: "string" as const, required: false },
];

function makeSpec(overrides: Partial<UISpec> = {}): UISpec {
  return {
    entity: "Item",
    fields: minimalFields,
    filters: [],
    ...overrides,
  } as UISpec;
}

describe("extractFingerprint", () => {
  it("does not throw when table is missing (list-only with fallback)", () => {
    const spec = makeSpec({ table: undefined });
    expect(() => extractFingerprint(spec)).not.toThrow();
    const fp = extractFingerprint(spec);
    expect(fp.tableColumns.size).toBe(0);
    expect(fp.fieldNames.size).toBe(2);
  });

  it("does not throw when form is missing (list-only resource)", () => {
    const spec = makeSpec({ form: undefined });
    expect(() => extractFingerprint(spec)).not.toThrow();
    const fp = extractFingerprint(spec);
    expect(fp.formFields.size).toBe(0);
    expect(fp.fieldNames.size).toBe(2);
  });

  it("does not throw when filters is missing", () => {
    const spec = makeSpec({ filters: undefined });
    expect(() => extractFingerprint(spec)).not.toThrow();
    const fp = extractFingerprint(spec);
    expect(fp.filterFields.size).toBe(0);
  });

  it("does not throw when detail is missing", () => {
    const spec = makeSpec({ detail: undefined });
    expect(() => extractFingerprint(spec)).not.toThrow();
    const fp = extractFingerprint(spec);
    expect(fp.detailFields.size).toBe(0);
  });

  it("does not throw when all optional sections are missing", () => {
    const spec = makeSpec({
      table: undefined,
      form: undefined,
      filters: undefined,
      detail: undefined,
    });
    expect(() => extractFingerprint(spec)).not.toThrow();
    const fp = extractFingerprint(spec);
    expect(fp.tableColumns.size).toBe(0);
    expect(fp.formFields.size).toBe(0);
    expect(fp.filterFields.size).toBe(0);
    expect(fp.detailFields.size).toBe(0);
    expect(fp.fieldNames).toEqual(new Set(["id", "name"]));
  });

  it("extracts fingerprint correctly when all sections present", () => {
    const spec = makeSpec({
      table: { columns: ["id", "name"] },
      form: { fields: ["name"] },
      filters: ["name"],
      detail: { fields: ["id", "name"] },
    });
    const fp = extractFingerprint(spec);
    expect(fp.tableColumns).toEqual(new Set(["id", "name"]));
    expect(fp.formFields).toEqual(new Set(["name"]));
    expect(fp.filterFields).toEqual(new Set(["name"]));
    expect(fp.detailFields).toEqual(new Set(["id", "name"]));
  });
});

describe("compareSpecsMulti with missing sections", () => {
  it("compares list-only spec (no form) without throwing", () => {
    const listOnly = makeSpec({
      table: { columns: ["id", "name"] },
      form: undefined,
      filters: undefined,
      detail: undefined,
    });
    const run1 = { items: listOnly };
    const run2 = { items: { ...listOnly } };
    expect(() => compareSpecsMulti(run1, run2)).not.toThrow();
    const result = compareSpecsMulti(run1, run2);
    expect(result.sameSlugs).toBe(true);
    expect(result.minSimilarity).toBe(1);
  });
});
