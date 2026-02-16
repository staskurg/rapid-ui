/**
 * Demo API adapter. Full CRUD via /api/demo/[resource] routes.
 * getSample() uses seed data; list/create/update/remove use session-scoped data.
 */

import type { CrudAdapter } from "./types";
import type { DemoVersion } from "@/lib/demoStore/seeds";

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  return url.toString();
}

export function createDemoAdapter(
  resource: string,
  sessionId: string,
  version: DemoVersion
): CrudAdapter {
  const base = `/api/demo/${resource}`;
  const q = { session: sessionId, v: String(version) };

  return {
    mode: "demo",
    capabilities: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },

    async getSample(): Promise<Record<string, unknown>[]> {
      const url = buildUrl(`${base}/sample`, { v: String(version) });
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch sample: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },

    async list(): Promise<Record<string, unknown>[]> {
      const url = buildUrl(base, q);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch list: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },

    async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
      const url = buildUrl(base, q);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Create failed: ${res.status}`);
      }
      return res.json();
    },

    async update(id: string | number, input: Record<string, unknown>): Promise<Record<string, unknown>> {
      const url = buildUrl(`${base}/${encodeURIComponent(String(id))}`, q);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Update failed: ${res.status}`);
      }
      return res.json();
    },

    async remove(id: string | number): Promise<void> {
      const url = buildUrl(`${base}/${encodeURIComponent(String(id))}`, q);
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Delete failed: ${res.status}`);
      }
    },
  };
}
