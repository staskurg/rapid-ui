/**
 * In-memory compilation store.
 * Keyed by id (12-char UUID).
 * Resets on server restart.
 *
 * Uses globalThis in dev so the store survives Turbopack hot reloads;
 * otherwise the module is re-evaluated and the Map is recreated empty.
 */
import type { UISpec } from "@/lib/spec/types";
import type { ApiIR } from "./apiir";

export interface CompilationEntry {
  specs: Record<string, UISpec>;
  resourceNames: string[];
  resourceSlugs: string[];
  apiIr: ApiIR;
  openapiCanonicalHash: string;
  /** Account that owns this compilation (for listing/filtering). */
  accountId?: string;
  /** Display name: apiIr.api.title or first resource. */
  name?: string;
  status?: "success" | "failed";
  errors?: unknown[];
  /** Formatted diff from previous version (update flow). Grouped by page with per-page added/removed fields. */
  diffFromPrevious?: {
    byPage: Array<{
      name: string;
      type: "added" | "removed" | "unchanged";
      addedFields: string[];
      removedFields: string[];
    }>;
  };
  /** UTC ISO string. Set on create. */
  createdAt?: string;
  /** UTC ISO string. Set on create and every update. */
  updatedAt?: string;
}

const GLOBAL_KEY = "__rapidui_compilation_store";

function getStore(): Map<string, CompilationEntry> {
  const g = globalThis as typeof globalThis & { [key: string]: Map<string, CompilationEntry> };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

export function putCompilation(
  id: string,
  entry: Omit<CompilationEntry, "createdAt" | "updatedAt"> & Partial<Pick<CompilationEntry, "createdAt" | "updatedAt">>
): void {
  const now = new Date().toISOString();
  const existing = getStore().get(id);
  const merged: CompilationEntry = {
    ...entry,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  getStore().set(id, merged);
}

export function getCompilation(id: string): CompilationEntry | undefined {
  return getStore().get(id);
}

export function hasCompilation(id: string): boolean {
  return getStore().has(id);
}

export interface CompilationListItem {
  id: string;
  name: string;
  status: "success" | "failed";
  createdAt?: string;
  updatedAt?: string;
}

/**
 * List compilations for an account. Filters by entry.accountId.
 * Sorted by updatedAt descending (most recently updated first).
 */
export function listCompilationsByAccount(
  accountId: string
): CompilationListItem[] {
  const items: CompilationListItem[] = [];
  for (const [id, entry] of getStore().entries()) {
    if (entry.accountId === accountId) {
      items.push({
        id,
        name: entry.name ?? id,
        status: entry.status ?? "success",
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    }
  }
  items.sort((a, b) => {
    const aAt = a.updatedAt ?? a.createdAt ?? "";
    const bAt = b.updatedAt ?? b.createdAt ?? "";
    return bAt.localeCompare(aAt);
  });
  return items;
}

/**
 * Delete a compilation by id. Idempotent: no-op if id missing.
 */
export function deleteCompilation(id: string): void {
  getStore().delete(id);
}
