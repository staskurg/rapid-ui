/**
 * Demo adapter — full CRUD adapter for demo API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDemoAdapter } from "@/lib/adapters/demo-adapter";

describe("createDemoAdapter", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    mockFetch.mockReset();
  });

  it("returns adapter with mode demo", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const adapter = createDemoAdapter("users", "session-123", 1);
    expect(adapter.mode).toBe("demo");
  });

  it("has full CRUD capabilities", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const adapter = createDemoAdapter("users", "session-123", 1);
    expect(adapter.capabilities).toEqual({
      create: true,
      read: true,
      update: true,
      delete: true,
    });
  });

  it("getSample calls /sample with version param", async () => {
    const data = [{ id: 1, name: "Alice" }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const adapter = createDemoAdapter("users", "session-123", 1);
    const result = await adapter.getSample();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/demo/users/sample")
    );
    expect(mockFetch.mock.calls[0][0]).toContain("v=1");
    expect(result).toEqual(data);
  });

  it("list calls GET with session and version params", async () => {
    const data = [{ id: 1 }, { id: 2 }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const adapter = createDemoAdapter("users", "session-123", 2);
    const result = await adapter.list();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/demo/users")
    );
    expect(mockFetch.mock.calls[0][0]).toContain("session=session-123");
    expect(mockFetch.mock.calls[0][0]).toContain("v=2");
    expect(result).toEqual(data);
  });

  it("getById fetches single record", async () => {
    const record = { id: 1, name: "Alice" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(record),
    });

    const adapter = createDemoAdapter("users", "session-123", 1);
    const result = await adapter.getById!(1);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/demo/users/1")
    );
    expect(result).toEqual(record);
  });

  it("create calls POST with body", async () => {
    const created = { id: 1, name: "Alice" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(created),
    });

    const adapter = createDemoAdapter("users", "session-123", 1);
    const result = await adapter.create!({ name: "Alice" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/demo/users"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alice" }),
      })
    );
    expect(result).toEqual(created);
  });

  it("update calls PUT with id and body", async () => {
    const updated = { id: 1, name: "Alice Updated" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updated),
    });

    const adapter = createDemoAdapter("users", "session-123", 1);
    const result = await adapter.update!(1, { name: "Alice Updated" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/demo/users/1"),
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alice Updated" }),
      })
    );
    expect(result).toEqual(updated);
  });

  it("remove calls DELETE", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const adapter = createDemoAdapter("users", "session-123", 1);
    await adapter.remove!(1);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/demo/users/1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws when getSample fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const adapter = createDemoAdapter("users", "session-123", 1);

    await expect(adapter.getSample()).rejects.toThrow("Failed to fetch sample");
  });

  it("throws when create fails with error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Validation failed" }),
    });

    const adapter = createDemoAdapter("users", "session-123", 1);

    await expect(adapter.create!({})).rejects.toThrow("Validation failed");
  });
});
