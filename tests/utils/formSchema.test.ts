/**
 * formSchema utilities tests.
 * Verifies buildNestedSchema, getErrorByPath, setNested, buildNestedDefaults, mergeNested.
 */
import { describe, it, expect } from "vitest";
import {
  buildNestedSchema,
  getErrorByPath,
  setNested,
  buildNestedDefaults,
  mergeNested,
} from "@/lib/utils/formSchema";
import type { UISpec } from "@/lib/spec/types";

describe("buildNestedSchema", () => {
  it("builds flat schema for flat-only fields", () => {
    const spec: UISpec = {
      entity: "User",
      fields: [
        { name: "email", label: "Email", type: "string", required: true },
        { name: "id", label: "ID", type: "number", required: false },
      ],
      table: { columns: ["email", "id"] },
      form: { fields: ["email", "id"] },
      filters: [],
    };
    const schema = buildNestedSchema(spec);
    const result = schema.safeParse({ email: "a@b.com", id: 1 });
    expect(result.success).toBe(true);
    expect(schema.safeParse({ email: "a@b.com" }).success).toBe(true); // id optional
    expect(schema.safeParse({}).success).toBe(false); // email required
  });

  it("builds nested schema for dot-path fields", () => {
    const spec: UISpec = {
      entity: "User",
      fields: [
        { name: "email", label: "Email", type: "string", required: true },
        { name: "profile.firstName", label: "First Name", type: "string", required: true },
        { name: "profile.lastName", label: "Last Name", type: "string", required: false },
      ],
      table: { columns: ["email", "profile.firstName", "profile.lastName"] },
      form: { fields: ["email", "profile.firstName", "profile.lastName"] },
      filters: [],
    };
    const schema = buildNestedSchema(spec);
    const valid = {
      email: "a@b.com",
      profile: { firstName: "Alice", lastName: "Smith" },
    };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ email: "a@b.com", profile: { firstName: "Alice" } }).success).toBe(true);
    expect(schema.safeParse({ email: "a@b.com" }).success).toBe(false); // profile.firstName required
    expect(schema.safeParse({ "profile.firstName": "Alice" }).success).toBe(false); // flat keys rejected
  });
});

describe("getErrorByPath", () => {
  it("returns undefined for empty errors", () => {
    expect(getErrorByPath(undefined, "profile.firstName")).toBeUndefined();
    expect(getErrorByPath({}, "profile.firstName")).toBeUndefined();
  });

  it("resolves nested error by dot path", () => {
    const errors = {
      profile: { firstName: { message: "Required" } },
    };
    expect(getErrorByPath(errors, "profile.firstName")?.message).toBe("Required");
  });

  it("resolves flat error", () => {
    const errors = { email: { message: "Invalid email" } };
    expect(getErrorByPath(errors, "email")?.message).toBe("Invalid email");
  });
});

describe("setNested", () => {
  it("sets value at dot path", () => {
    const obj: Record<string, unknown> = {};
    setNested(obj, "profile.newsletter", false);
    expect(obj).toEqual({ profile: { newsletter: false } });
  });

  it("creates deep structure", () => {
    const obj: Record<string, unknown> = {};
    setNested(obj, "a.b.c", "value");
    expect(obj).toEqual({ a: { b: { c: "value" } } });
  });
});

describe("buildNestedDefaults", () => {
  it("builds nested defaults for optional booleans", () => {
    const spec: UISpec = {
      entity: "User",
      fields: [
        { name: "profile.newsletter", label: "Newsletter", type: "boolean", required: false },
      ],
      table: { columns: ["profile.newsletter"] },
      form: { fields: ["profile.newsletter"] },
      filters: [],
    };
    const defaults = buildNestedDefaults(spec);
    expect(defaults).toEqual({ profile: { newsletter: false } });
  });
});

describe("mergeNested", () => {
  it("merges defaults with initialValues preserving optional booleans", () => {
    const defaults = { profile: { newsletter: false } };
    const initial = { profile: { firstName: "Alice", lastName: "Smith" } };
    const merged = mergeNested(defaults, initial);
    expect(merged).toEqual({
      profile: { firstName: "Alice", lastName: "Smith", newsletter: false },
    });
  });

  it("overwrites when both have same key with non-object value", () => {
    const a = { x: 1 };
    const b = { x: 2 };
    expect(mergeNested(a, b)).toEqual({ x: 2 });
  });
});
