/**
 * Capability-driven navigation for SchemaRenderer.
 * Pure functions — no inference, no heuristics.
 */

import type { Capabilities } from "@/lib/compiler/apiir";
import type { AdapterCapabilities } from "@/lib/adapters";

export type RendererMode = "table" | "identity" | "form";

export const MODE_TABLE: RendererMode = "table";
export const MODE_IDENTITY: RendererMode = "identity";
export const MODE_FORM: RendererMode = "form";

/**
 * Resolve navigation mode from capabilities.
 * Priority: list → table; detail|update → identity; create → form; else form.
 */
export function resolveNavigation(capabilities: Capabilities): RendererMode {
  if (capabilities.list) return MODE_TABLE;
  if (capabilities.detail || capabilities.update) return MODE_IDENTITY;
  if (capabilities.create) return MODE_FORM;
  return MODE_FORM;
}

/**
 * Normalize AdapterCapabilities to Capabilities.
 * Adapter has `read` not `list`/`detail`; both derive from read to avoid impossible states.
 */
export function normalizeAdapterCapabilities(
  adapter: AdapterCapabilities
): Capabilities {
  return {
    list: adapter.read,
    detail: adapter.read,
    create: adapter.create,
    update: adapter.update,
    delete: adapter.delete,
  };
}
