/**
 * In-memory compilation store.
 * Keyed by id (first 12 chars of openapiCanonicalHash).
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
  entry: CompilationEntry
): void {
  getStore().set(id, entry);
}

export function getCompilation(id: string): CompilationEntry | undefined {
  return getStore().get(id);
}

export function hasCompilation(id: string): boolean {
  return getStore().has(id);
}
