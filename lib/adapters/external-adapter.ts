/**
 * External API adapter. Read-only.
 * getSample() and list() both call proxy with url + dataPath.
 */

import type { CrudAdapter } from "./types";

export function createExternalAdapter(
  url: string,
  dataPath?: string
): CrudAdapter {
  const fetchData = async (): Promise<Record<string, unknown>[]> => {
    const res = await fetch("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, dataPath: dataPath || undefined }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: string }).error ?? `Failed to fetch: ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  };

  return {
    mode: "external",
    capabilities: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },

    async getSample(): Promise<Record<string, unknown>[]> {
      return fetchData();
    },

    async list(): Promise<Record<string, unknown>[]> {
      return fetchData();
    },
  };
}
