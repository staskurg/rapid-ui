import { describe, it, expect } from "vitest";
import {
  computeMultiSpecDiff,
  computeSpecDiff,
  type UISpecMap,
} from "@/lib/spec/diff";
import {
  formatDiffForDisplay,
  formatMultiSpecDiffForDisplay,
} from "@/lib/spec/diffFormatters";
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

const taskSpec: UISpec = {
  entity: "Task",
  fields: [
    { name: "id", label: "ID", type: "string", required: true },
    { name: "title", label: "Title", type: "string", required: true },
    { name: "status", label: "Status", type: "string", required: false },
  ],
  table: { columns: ["id", "title", "status"] },
  form: { fields: ["title", "status"] },
  filters: ["status"],
  idField: "id",
};

describe("computeMultiSpecDiff", () => {
  it("returns empty diff for identical multi-specs", () => {
    const specs = { users: baseSpec, tasks: taskSpec };
    const diff = computeMultiSpecDiff(specs, specs);
    expect(diff.resourcesAdded).toEqual([]);
    expect(diff.resourcesRemoved).toEqual([]);
    expect(Object.keys(diff.resourceDiffs)).toEqual(["users", "tasks"]);
    expect(diff.resourceDiffs.users.fieldsAdded).toEqual([]);
    expect(diff.resourceDiffs.tasks.fieldsAdded).toEqual([]);
  });

  it("detects resource added", () => {
    const prev = { users: baseSpec };
    const next = { users: baseSpec, tasks: taskSpec };
    const diff = computeMultiSpecDiff(prev, next);
    expect(diff.resourcesAdded).toEqual(["tasks"]);
    expect(diff.resourcesRemoved).toEqual([]);
    expect(Object.keys(diff.resourceDiffs)).toEqual(["users"]);
  });

  it("detects resource removed", () => {
    const prev = { users: baseSpec, tasks: taskSpec };
    const next = { users: baseSpec };
    const diff = computeMultiSpecDiff(prev, next);
    expect(diff.resourcesAdded).toEqual([]);
    expect(diff.resourcesRemoved).toEqual(["tasks"]);
    expect(Object.keys(diff.resourceDiffs)).toEqual(["users"]);
  });

  it("detects field changes within resource", () => {
    const prev = { users: baseSpec };
    const next: UISpecMap = {
      users: {
        ...baseSpec,
        fields: [
          ...baseSpec.fields,
          { name: "department", label: "Department", type: "string", required: false },
        ],
        table: { columns: ["id", "name", "email", "department"] },
        form: { fields: ["name", "email", "department"] },
      },
    };
    const diff = computeMultiSpecDiff(prev, next);
    expect(diff.resourcesAdded).toEqual([]);
    expect(diff.resourcesRemoved).toEqual([]);
    expect(diff.resourceDiffs.users.fieldsAdded).toEqual(["department"]);
    expect(diff.resourceDiffs.users.fieldsRemoved).toEqual([]);
  });
});

describe("formatMultiSpecDiffForDisplay", () => {
  it("returns empty arrays for empty multi-diff", () => {
    const specs = { users: baseSpec, tasks: taskSpec };
    const multiDiff = computeMultiSpecDiff(specs, specs);
    const result = formatMultiSpecDiffForDisplay(multiDiff, specs, specs);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("formats resource added with entity name", () => {
    const prev = { users: baseSpec };
    const next = { users: baseSpec, tasks: taskSpec };
    const multiDiff = computeMultiSpecDiff(prev, next);
    const result = formatMultiSpecDiffForDisplay(multiDiff, prev, next);
    expect(result.added).toContain("Task");
    expect(result.removed).toEqual([]);
  });

  it("formats resource removed with entity name", () => {
    const prev = { users: baseSpec, tasks: taskSpec };
    const next = { users: baseSpec };
    const multiDiff = computeMultiSpecDiff(prev, next);
    const result = formatMultiSpecDiffForDisplay(multiDiff, prev, next);
    expect(result.added).toEqual([]);
    expect(result.removed).toContain("Task");
  });

  it("formats field changes with humanized names", () => {
    const prev: UISpecMap = { users: baseSpec };
    const next: UISpecMap = {
      users: {
        ...baseSpec,
        fields: [
          ...baseSpec.fields,
          { name: "department", label: "Department", type: "string", required: false },
        ],
        table: { columns: ["id", "name", "email", "department"] },
        form: { fields: ["name", "email", "department"] },
      },
    };
    const multiDiff = computeMultiSpecDiff(prev, next);
    const result = formatMultiSpecDiffForDisplay(multiDiff, prev, next);
    expect(result.added).toContain("Department");
    expect(result.removed).toEqual([]);
  });

  it("formats field removed", () => {
    const prev: UISpecMap = {
      users: {
        ...baseSpec,
        fields: [
          ...baseSpec.fields,
          { name: "role", label: "Role", type: "string", required: false },
        ],
        table: { columns: ["id", "name", "email", "role"] },
        form: { fields: ["name", "email", "role"] },
      },
    };
    const next: UISpecMap = { users: baseSpec };
    const multiDiff = computeMultiSpecDiff(prev, next);
    const result = formatMultiSpecDiffForDisplay(multiDiff, prev, next);
    expect(result.added).toEqual([]);
    expect(result.removed).toContain("Role");
  });
});
