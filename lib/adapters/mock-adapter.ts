/**
 * Mock CRUD adapter for compiled UI.
 * Calls /api/mock/[id]/[resource]. No session — URLs are shareable.
 */

import type { CrudAdapter } from "./types";

function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function createMockAdapter(
  compilationId: string,
  resource: string
): CrudAdapter {
  const base = getBaseUrl();
  const listUrl = `${base}/api/mock/${compilationId}/${resource}`;
  const itemUrl = (id: string | number) =>
    `${base}/api/mock/${compilationId}/${resource}/${encodeURIComponent(String(id))}`;

  return {
    mode: "mock",
    capabilities: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    async getSample() {
      const res = await fetch(listUrl);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      const data = await res.json();
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    async list() {
      const res = await fetch(listUrl);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      const data = await res.json();
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    async getById(id: string | number) {
      const res = await fetch(itemUrl(id));
      if (!res.ok) {
        if (res.status === 404) throw new Error("Not found");
        throw new Error(`Failed to fetch: ${res.statusText}`);
      }
      return res.json();
    },
    async create(input: Record<string, unknown>) {
      const res = await fetch(listUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to create: ${res.statusText}`);
      return res.json();
    },
    async update(id: string | number, input: Record<string, unknown>) {
      const res = await fetch(itemUrl(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to update: ${res.statusText}`);
      return res.json();
    },
    async remove(id: string | number) {
      const res = await fetch(itemUrl(id), { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`);
    },
  };
}
