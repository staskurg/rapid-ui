Below is a **drop-in, deterministic UiPlanIR normalizer** written in **TypeScript**, designed to run **immediately after Zod validation**.

It guarantees:

* byte-stable output
* stable ordering
* no duplicate fields
* no accidental mutations
* zero heuristics beyond what we already locked

This function is part of the **compiler correctness surface**, not “cleanup.”

---

## UiPlanIR Normalizer (Authoritative)

### What it does (exactly)

1. **Sorts resources** lexicographically by `name`
2. **Normalizes views** in fixed order: `list → detail → create → edit`
3. **Deduplicates fields** by `path` (first occurrence wins)
4. **Sorts fields** deterministically:

   * `order` ascending (missing = +∞)
   * then `path` lexicographically
5. **Strips undefined keys** (important for stable JSON)
6. Produces a **new object** (no mutation)

---

## TypeScript Implementation

```ts
import type { UiPlanIR, ResourcePlan, ViewPlan, FieldPlan } from "./uiplan-schema";

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

/* ---------------- Resource ---------------- */

function normalizeResource(resource: ResourcePlan): ResourcePlan {
  const views = normalizeViews(resource.views);

  return {
    name: resource.name,
    views,
  };
}

/* ---------------- Views ---------------- */

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

/* ---------------- Fields ---------------- */

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

/* ---------------- Utilities ---------------- */

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}
```

---

## When to run this (compiler contract)

Your **exact pipeline** should be:

```ts
const parsed = UiPlanIRSchema.parse(llmOutput);
const normalized = normalizeUiPlanIR(parsed);
const uiPlanHash = sha256(stableStringify(normalized));
```

Never hash:

* raw LLM output
* pre-normalized UiPlanIR

Always hash **post-normalization**.

---

## Why this is sufficient (and not more)

This normalizer:

* does **not** invent defaults
* does **not** reorder semantics
* does **not** infer anything
* does **not** “fix” invalid plans

It only:

* enforces determinism
* protects against benign LLM variance
* makes snapshot tests reliable

That’s exactly what a compiler normalizer should do.
