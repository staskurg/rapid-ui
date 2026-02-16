import { describe, it, expect } from "vitest";
import { computeSpecDiff } from "@/lib/spec/diff";
import { formatDiffForDisplay } from "@/lib/spec/diffFormatters";
import type { UISpec } from "@/lib/spec/schema";

const baseSpec: UISpec = {
  entity: "User",
  fields: [
    { name: "id", label: "ID", type: "string", required: true },
    { name: "name", label: "Name", type: "string", required: true },
    { name: "email", label: "Email", type: "string", required: false },
  ],
  table: { columns: ["id", "name", "email"] },
  form: { fields: ["name", "email"] },
  filters: ["name"],
  idField: "id",
};

describe("computeSpecDiff", () => {
  it("returns empty diff for identical specs", () => {
    const diff = computeSpecDiff(baseSpec, baseSpec);
    expect(diff.entityChanged).toBe(false);
    expect(diff.fieldsAdded).toEqual([]);
    expect(diff.fieldsRemoved).toEqual([]);
    expect(diff.fieldsChanged).toEqual([]);
    expect(diff.tableColumnsAdded).toEqual([]);
    expect(diff.tableColumnsRemoved).toEqual([]);
    expect(diff.formFieldsAdded).toEqual([]);
    expect(diff.formFieldsRemoved).toEqual([]);
    expect(diff.filtersAdded).toEqual([]);
    expect(diff.filtersRemoved).toEqual([]);
    expect(diff.idFieldChanged).toBe(false);
  });

  it("detects added field", () => {
    const next: UISpec = {
      ...baseSpec,
      fields: [
        ...baseSpec.fields,
        { name: "role", label: "Role", type: "string", required: false },
      ],
      table: { columns: ["id", "name", "email", "role"] },
      form: { fields: ["name", "email", "role"] },
    };
    const diff = computeSpecDiff(baseSpec, next);
    expect(diff.fieldsAdded).toEqual(["role"]);
    expect(diff.fieldsRemoved).toEqual([]);
    expect(diff.tableColumnsAdded).toEqual(["role"]);
    expect(diff.formFieldsAdded).toEqual(["role"]);
  });

  it("detects removed field", () => {
    const next: UISpec = {
      ...baseSpec,
      fields: baseSpec.fields.filter((f) => f.name !== "email"),
      table: { columns: ["id", "name"] },
      form: { fields: ["name"] },
      filters: [],
    };
    const diff = computeSpecDiff(baseSpec, next);
    expect(diff.fieldsAdded).toEqual([]);
    expect(diff.fieldsRemoved).toEqual(["email"]);
    expect(diff.tableColumnsRemoved).toEqual(["email"]);
    expect(diff.formFieldsRemoved).toEqual(["email"]);
    expect(diff.filtersRemoved).toEqual(["name"]);
  });

  it("detects changed field", () => {
    const next: UISpec = {
      ...baseSpec,
      fields: baseSpec.fields.map((f) =>
        f.name === "name" ? { ...f, label: "Full Name" } : f
      ),
    };
    const diff = computeSpecDiff(baseSpec, next);
    expect(diff.fieldsChanged).toHaveLength(1);
    expect(diff.fieldsChanged[0].name).toBe("name");
    expect(diff.fieldsChanged[0].prev.label).toBe("Name");
    expect(diff.fieldsChanged[0].next.label).toBe("Full Name");
  });

  it("detects entity change", () => {
    const next: UISpec = { ...baseSpec, entity: "Users" };
    const diff = computeSpecDiff(baseSpec, next);
    expect(diff.entityChanged).toBe(true);
  });

  it("detects idField change", () => {
    const next: UISpec = { ...baseSpec, idField: "userId" };
    const diff = computeSpecDiff(baseSpec, next);
    expect(diff.idFieldChanged).toBe(true);
  });
});

describe("formatDiffForDisplay", () => {
  it("returns empty arrays for empty diff", () => {
    const diff = computeSpecDiff(baseSpec, baseSpec);
    const result = formatDiffForDisplay(diff, baseSpec, baseSpec);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("formats added field with human label, consolidated (Table, Form)", () => {
    const next: UISpec = {
      ...baseSpec,
      fields: [
        ...baseSpec.fields,
        { name: "department", label: "Department", type: "string", required: false },
      ],
      table: { columns: ["id", "name", "email", "department"] },
      form: { fields: ["name", "email", "department"] },
    };
    const diff = computeSpecDiff(baseSpec, next);
    const result = formatDiffForDisplay(diff, baseSpec, next);
    expect(result.added).toContain("Department (Table, Form)");
  });

  it("caps output at ~7 items", () => {
    const next: UISpec = {
      ...baseSpec,
      fields: [
        ...baseSpec.fields,
        { name: "a", label: "A", type: "string", required: false },
        { name: "b", label: "B", type: "string", required: false },
        { name: "c", label: "C", type: "string", required: false },
        { name: "d", label: "D", type: "string", required: false },
        { name: "e", label: "E", type: "string", required: false },
      ],
      table: { columns: ["id", "name", "email", "a", "b", "c", "d", "e"] },
      form: { fields: ["name", "email", "a", "b", "c", "d", "e"] },
    };
    const diff = computeSpecDiff(baseSpec, next);
    const result = formatDiffForDisplay(diff, baseSpec, next);
    const total = result.added.length + result.removed.length;
    expect(total).toBeLessThanOrEqual(8); // 7 + possible "X more…"
  });
});
