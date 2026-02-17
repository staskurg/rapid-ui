/**
 * Phase 4: extractArrayFromResponse — data path extraction
 */

import { describe, it, expect } from "vitest";
import { extractArrayFromResponse } from "@/lib/utils/extractDataPath";

describe("extractArrayFromResponse", () => {
  it("returns empty array for null or undefined", () => {
    expect(extractArrayFromResponse(null)).toEqual([]);
    expect(extractArrayFromResponse(undefined)).toEqual([]);
  });

  it("returns direct array as-is", () => {
    const arr = [{ id: 1 }, { id: 2 }];
    expect(extractArrayFromResponse(arr)).toEqual(arr);
  });

  it("returns empty for non-array primitives", () => {
    expect(extractArrayFromResponse("foo")).toEqual([]);
    expect(extractArrayFromResponse(42)).toEqual([]);
    expect(extractArrayFromResponse(true)).toEqual([]);
  });

  it("extracts array from data path", () => {
    const body = { data: [{ id: 1 }] };
    expect(extractArrayFromResponse(body, "data")).toEqual([{ id: 1 }]);
  });

  it("extracts array from results path", () => {
    const body = { results: [{ id: 1 }, { id: 2 }] };
    expect(extractArrayFromResponse(body, "results")).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("extracts array from users path", () => {
    const body = { users: [{ id: 1, name: "Alice" }] };
    expect(extractArrayFromResponse(body, "users")).toEqual([
      { id: 1, name: "Alice" },
    ]);
  });

  it("returns empty when dataPath points to non-array", () => {
    const body = { data: "not an array" };
    expect(extractArrayFromResponse(body, "data")).toEqual([]);
  });

  it("returns empty when dataPath points to missing key", () => {
    const body = { other: [] };
    expect(extractArrayFromResponse(body, "data")).toEqual([]);
  });

  it("auto-detects data key when no dataPath", () => {
    const body = { data: [{ id: 1 }] };
    expect(extractArrayFromResponse(body)).toEqual([{ id: 1 }]);
  });

  it("auto-detects results key when no dataPath", () => {
    const body = { results: [{ id: 1 }] };
    expect(extractArrayFromResponse(body)).toEqual([{ id: 1 }]);
  });

  it("auto-detects users key when no dataPath", () => {
    const body = { users: [{ id: 1 }] };
    expect(extractArrayFromResponse(body)).toEqual([{ id: 1 }]);
  });

  it("returns empty when object has no known array keys", () => {
    const body = { foo: "bar", count: 5 };
    expect(extractArrayFromResponse(body)).toEqual([]);
  });

  it("supports dot-notation for nested path", () => {
    const body = { response: { items: [{ id: 1 }] } };
    expect(extractArrayFromResponse(body, "response.items")).toEqual([
      { id: 1 },
    ]);
  });
});
