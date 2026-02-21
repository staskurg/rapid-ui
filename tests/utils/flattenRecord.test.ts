/**
 * flattenRecord / unflattenRecord tests.
 */

import { describe, it, expect } from "vitest";
import { flattenRecord } from "@/lib/utils/flattenRecord";
import { unflattenRecord } from "@/lib/utils/unflattenRecord";

describe("flattenRecord", () => {
  it("flattens nested object", () => {
    const obj = { profile: { firstName: "Alice", lastName: "Smith" } };
    expect(flattenRecord(obj)).toEqual({
      "profile.firstName": "Alice",
      "profile.lastName": "Smith",
    });
  });

  it("handles flat object", () => {
    const obj = { id: 1, name: "Test" };
    expect(flattenRecord(obj)).toEqual({ id: 1, name: "Test" });
  });

  it("handles deeply nested", () => {
    const obj = { a: { b: { c: "value" } } };
    expect(flattenRecord(obj)).toEqual({ "a.b.c": "value" });
  });

  it("round-trip with unflattenRecord", () => {
    const nested = { profile: { firstName: "Alice", lastName: "Smith" }, id: 1 };
    const flat = flattenRecord(nested);
    const back = unflattenRecord(flat);
    expect(back).toEqual(nested);
  });
});

describe("unflattenRecord", () => {
  it("unflattens dot-path keys", () => {
    const flat = { "profile.firstName": "Alice", "profile.lastName": "Smith" };
    expect(unflattenRecord(flat)).toEqual({
      profile: { firstName: "Alice", lastName: "Smith" },
    });
  });

  it("handles multiple siblings", () => {
    const flat = {
      "a.x": 1,
      "a.y": 2,
      "b.z": 3,
    };
    expect(unflattenRecord(flat)).toEqual({
      a: { x: 1, y: 2 },
      b: { z: 3 },
    });
  });

  it("skips undefined values", () => {
    const flat = { "a.b": "x", "a.c": undefined };
    const result = unflattenRecord(flat as Record<string, unknown>);
    expect(result).toEqual({ a: { b: "x" } });
  });
});
