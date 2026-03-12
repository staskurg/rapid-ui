/**
 * UiPlanIR normalizer — produces byte-stable, deterministic output.
 * Must be called AFTER schema validation.
 * stripUndefined only strips undefined; does not strip false or 0.
 * When apiIr is passed, validates every field.path exists in ApiIR; throws on invented paths.
 */

import type { ApiIR } from "../apiir/types";
import { slugify } from "@/lib/utils/slugify";
import { getResourcePathSet } from "../lowering/schema-to-field";
import { createError } from "../errors";
import type { UiPlanIR, ResourcePlan, ViewPlan, FieldPlan } from "./uiplan.schema";

/**
 * Normalize UiPlanIR into a byte-stable, deterministic form.
 * Must be called AFTER schema validation.
 * When apiIr is provided, validates every field.path exists in ApiIR; throws CompilerError on invented paths.
 * Production pipeline always passes apiIr.
 */
export function normalizeUiPlanIR(input: UiPlanIR, apiIr?: ApiIR): UiPlanIR {
  const pathSetBySlug =
    apiIr != null
      ? new Map(
          apiIr.resources.map((r) => [slugify(r.name), getResourcePathSet(r)])
        )
      : null;

  return {
    resources: [...input.resources]
      .map((r) => normalizeResource(r, pathSetBySlug))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function normalizeResource(
  resource: ResourcePlan,
  pathSetBySlug: Map<string, Set<string>> | null
): ResourcePlan {
  const pathSet =
    pathSetBySlug != null ? pathSetBySlug.get(slugify(resource.name)) ?? null : null;

  const views = normalizeViews(resource.views, pathSet);

  return {
    name: resource.name,
    views,
  };
}

const VIEW_ORDER = ["list", "detail", "create", "edit"] as const;
type ViewKey = (typeof VIEW_ORDER)[number];

function normalizeViews(
  views: ResourcePlan["views"],
  pathSet: Set<string> | null
): ResourcePlan["views"] {
  const normalized: Partial<Record<ViewKey, ViewPlan>> = {};

  for (const key of VIEW_ORDER) {
    const view = views[key];
    if (!view) continue;

    normalized[key] = {
      fields: normalizeFields(view.fields, pathSet),
    };
  }

  return normalized;
}

function normalizeFields(
  fields: FieldPlan[],
  pathSet: Set<string> | null
): FieldPlan[] {
  const seen = new Set<string>();
  const deduped: FieldPlan[] = [];

  for (const field of fields) {
    if (pathSet != null && !pathSet.has(field.path)) {
      throw createError(
        "UIPLAN_INVENTED_FIELD_PATH",
        "UiPlan",
        `Field path "${field.path}" does not exist in ApiIR schema`
      );
    }
    if (seen.has(field.path)) continue;
    seen.add(field.path);
    deduped.push(stripUndefined(field));
  }

  return deduped.sort(compareFields);
}

/** Blueprint: (a.order ?? 0) - (b.order ?? 0) || a.path.localeCompare(b.path) */
function compareFields(a: FieldPlan, b: FieldPlan): number {
  const orderA = a.order ?? 0;
  const orderB = b.order ?? 0;
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
