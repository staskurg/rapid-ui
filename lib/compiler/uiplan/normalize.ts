/**
 * UiPlanIR normalizer — produces byte-stable, deterministic output.
 * Must be called AFTER schema validation.
 * stripUndefined only strips undefined; does not strip false or 0.
 */

import type { UiPlanIR, ResourcePlan, ViewPlan, FieldPlan } from "./uiplan.schema";

/**
 * Normalize UiPlanIR into a byte-stable, deterministic form.
 * Must be called AFTER schema validation.
 */
export function normalizeUiPlanIR(input: UiPlanIR): UiPlanIR {
  return {
    resources: [...input.resources]
      .map(normalizeResource)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function normalizeResource(resource: ResourcePlan): ResourcePlan {
  const views = normalizeViews(resource.views);

  return {
    name: resource.name,
    views,
  };
}

const VIEW_ORDER = ["list", "detail", "create", "edit"] as const;
type ViewKey = (typeof VIEW_ORDER)[number];

function normalizeViews(
  views: ResourcePlan["views"]
): ResourcePlan["views"] {
  const normalized: Partial<Record<ViewKey, ViewPlan>> = {};

  for (const key of VIEW_ORDER) {
    const view = views[key];
    if (!view) continue;

    normalized[key] = {
      fields: normalizeFields(view.fields),
    };
  }

  return normalized;
}

function normalizeFields(fields: FieldPlan[]): FieldPlan[] {
  const seen = new Set<string>();
  const deduped: FieldPlan[] = [];

  for (const field of fields) {
    if (seen.has(field.path)) continue;
    seen.add(field.path);
    deduped.push(stripUndefined(field));
  }

  return deduped.sort(compareFields);
}

function compareFields(a: FieldPlan, b: FieldPlan): number {
  const orderA = a.order ?? Number.POSITIVE_INFINITY;
  const orderB = b.order ?? Number.POSITIVE_INFINITY;

  if (orderA !== orderB) return orderA - orderB;
  return a.path.localeCompare(b.path);
}

/** Strip undefined keys only. Preserve false and 0. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}
