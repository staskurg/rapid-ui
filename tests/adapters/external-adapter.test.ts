/**
 * Phase 4: External adapter — read-only adapter for external APIs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createExternalAdapter } from "@/lib/adapters/external-adapter";

describe("createExternalAdapter", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    mockFetch.mockReset();
  });

  it("returns adapter with mode external", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }]),
    });

    const adapter = createExternalAdapter("https://api.example.com/users");
    expect(adapter.mode).toBe("external");
  });

  it("has read-only capabilities", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const adapter = createExternalAdapter("https://api.example.com/users");
    expect(adapter.capabilities).toEqual({
      create: false,
      read: true,
      update: false,
      delete: false,
    });
  });

  it("getSample calls proxy with url and dataPath", async () => {
    const data = [{ id: 1, name: "Alice" }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const adapter = createExternalAdapter(
      "https://api.example.com/users",
      "data"
    );
    const result = await adapter.getSample();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/proxy",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.example.com/users",
          dataPath: "data",
        }),
      })
    );
    expect(result).toEqual(data);
  });

  it("list returns same data as getSample", async () => {
    const data = [{ id: 1 }, { id: 2 }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const adapter = createExternalAdapter("https://api.example.com/users");
    const listResult = await adapter.list();

    expect(listResult).toEqual(data);
  });

  it("throws when proxy returns error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: "Upstream returned 502" }),
    });

    const adapter = createExternalAdapter("https://api.example.com/users");

    await expect(adapter.getSample()).rejects.toThrow("Upstream returned 502");
  });

  it("does not have create, update, or remove methods", () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    const adapter = createExternalAdapter("https://api.example.com/users");

    expect(adapter.create).toBeUndefined();
    expect(adapter.update).toBeUndefined();
    expect(adapter.remove).toBeUndefined();
  });
});
