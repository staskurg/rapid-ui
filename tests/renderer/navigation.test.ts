import { describe, it, expect } from "vitest";
import {
  resolveNavigation,
  normalizeAdapterCapabilities,
  MODE_TABLE,
  MODE_IDENTITY,
  MODE_FORM,
  type RendererMode,
} from "@/components/renderer/navigation";
import type { Capabilities } from "@/lib/compiler/apiir";

function cap(
  list: boolean,
  detail: boolean,
  create: boolean,
  update: boolean,
  delete_?: boolean
): Capabilities {
  return {
    list,
    detail,
    create,
    update,
    delete: delete_ ?? false,
  };
}

describe("resolveNavigation", () => {
  const cases: { name: string; caps: Capabilities; expected: RendererMode }[] = [
    { name: "create-only", caps: cap(false, false, true, false), expected: MODE_FORM },
    {
      name: "create-update",
      caps: cap(false, false, true, true),
      expected: MODE_IDENTITY,
    },
    { name: "detail-only", caps: cap(false, true, false, false), expected: MODE_IDENTITY },
    {
      name: "detail-update",
      caps: cap(false, true, true, true),
      expected: MODE_IDENTITY,
    },
    { name: "list-only", caps: cap(true, false, false, false), expected: MODE_TABLE },
    { name: "list-create", caps: cap(true, false, true, false), expected: MODE_TABLE },
    { name: "list-detail", caps: cap(true, true, false, false), expected: MODE_TABLE },
    {
      name: "list-detail-create",
      caps: cap(true, true, true, false),
      expected: MODE_TABLE,
    },
    {
      name: "list-detail-update",
      caps: cap(true, true, false, true),
      expected: MODE_TABLE,
    },
    {
      name: "list-detail-create-update",
      caps: cap(true, true, true, true),
      expected: MODE_TABLE,
    },
    {
      name: "list-detail-delete",
      caps: cap(true, true, false, false, true),
      expected: MODE_TABLE,
    },
    { name: "update-only", caps: cap(false, false, false, true), expected: MODE_IDENTITY },
  ];

  for (const { name, caps, expected } of cases) {
    it(`${name} → ${expected}`, () => {
      expect(resolveNavigation(caps)).toBe(expected);
    });
  }

  it("empty capabilities → form", () => {
    expect(resolveNavigation(cap(false, false, false, false))).toBe(MODE_FORM);
  });
});

describe("normalizeAdapterCapabilities", () => {
  it("maps read to list and detail", () => {
    const result = normalizeAdapterCapabilities({
      create: false,
      read: true,
      update: false,
      delete: false,
    });
    expect(result.list).toBe(true);
    expect(result.detail).toBe(true);
  });

  it("preserves create, update, delete", () => {
    const result = normalizeAdapterCapabilities({
      create: true,
      read: false,
      update: true,
      delete: true,
    });
    expect(result.create).toBe(true);
    expect(result.update).toBe(true);
    expect(result.delete).toBe(true);
    expect(result.list).toBe(false);
    expect(result.detail).toBe(false);
  });
});
