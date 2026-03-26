# Pre–Phase 6: listScoped-aware archetypes (Track A)

This document is the **contract** for extending the archetype extractor **before** lowering, mock, and UiPlan work (**Phase 6** in `.cursor/plans/apiir_corpus_reports_vnext_*.plan.md`). It does **not** replace pattern mining or UI readiness; it **adds operation-kind dimensions** the original **22 archetypes** did not name, so **golden candidates** can intentionally cover **scoped list** and related UI cases.

---

## 1. Why Track A first (and where Track B fits)

| Track                      | What it is                                                                                                                                                                   | When to use                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Archetypes in code** | New archetype IDs in `ARCHETYPES` / `ARCHETYPE_ORDER`, rules in `classifyResourceArchetypes`, docs in `docs/golden-archetypes.md`, tests, then `npm run extract:archetypes`. | **Do this first.** Golden-candidates and `archetypes.json` then **tag** resources with listScoped-related buckets; Phase 6 tests can **pin** specs per archetype. |
| **B — Coverage report**    | Optional script or section: cross-tab (e.g. “structural archetype × has listScoped”) from the same metrics, Markdown output.                                                 | **After A**, or in parallel if you only need a one-off dashboard. Not a substitute for archetypes in the extractor.                                               |

**Recommendation:** Implement **Track A** in full, then add **Track B** only if you want a **read-only** report without querying JSON. Everything can live in **one** mental model: **IR → metrics → classification (22 + N) → golden candidates**; Track B is an **extra view**, not a second source of truth.

---

## 2. Problem being solved

- **`deriveOperationPattern`** treats **`list` and `listScoped`** together for patterns like `list_only` / `list_detail`, so **structural** archetypes (e.g. `simple_list`, `list_detail`) **do not distinguish** “root list” vs “scoped list.”
- **Phase 6** must handle **scope vs row**, **`idField`** not from scope param, mock routes, and **required query on list-like** ops. Those need **explicit regression buckets**, not only population % from mining.

---

## 3. Proposed new resource-level archetypes

Rules use **`OperationIR`** on the resource: `operations[].kind`, `operations[].parameters[]` with `in: query` and `required: true` (see `ParameterIR` in ApiIR).

| ID                             | Rule (all on one resource)                                                                                                                | Phase 6 / UI intent                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **`list_scoped`**              | At least one operation has `kind === listScoped`.                                                                                         | Baseline: UI and mock treat **scoped collection** (not row detail).                           |
| **`list_scoped_with_detail`**  | At least one `listScoped` **and** at least one `detail` on the **same** resource.                                                         | **Critical:** URL / store must not confuse **scope id** with **row id**; table + item routes. |
| **`list_scoped_only`**         | At least one `listScoped`, **no** `detail` on that resource.                                                                              | **`idField`** / item route **404** behavior; no row GET.                                      |
| **`required_query_list_like`** | At least one **list-like** op (`list` or `listScoped`) has a **required** query parameter (`ParameterIR.required === true`, `in: query`). | Filters / required inputs before list loads (aligns with `corpus:ui-readiness` aggregate).    |

**Naming:** snake_case, consistent with existing `simple_list`, `array_root_list`, etc.

**Mutually exclusive?** No. A resource may match **`list_scoped`** and **`list_scoped_with_detail`** at once; **`required_query_list_like`** can stack with any of them. **`list_scoped_only`** should be defined so it does **not** apply when `list_scoped_with_detail` applies (only-only is exclusive with with-detail).

**Optional later (analyze after first pass):**

| ID                           | Rule                                        | Notes                                                                                                                            |
| ---------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **`multiple_list_like_ops`** | `filterListLikeOperations(ops).length >= 2` | Same resource has e.g. `list` + `listScoped`; primary op precedence for seeds. Lower priority unless mining shows meaningful % . |

---

## 4. Metrics to add (implementation hint)

In `extractResourceMetrics` / `ResourceArchetypeMetrics`, derive from `resource.operations`:

- `hasListScoped: boolean`
- `hasListScopedWithDetail: boolean` — `hasListScoped && hasDetail`
- `hasListScopedOnly: boolean` — `hasListScoped && !hasDetail`
- `hasRequiredQueryOnListLike: boolean` — for some op with `isListLikeKind(kind)`, `parameters` has required query

Reuse helpers: `OPERATION_KIND`, `isListLikeKind`, `PARAMETER_IN` from `@/lib/compiler/apiir`.

Append new branches in **`classifyResourceArchetypes`** **after** existing rules (extend **`ARCHETYPE_ORDER`** in a **fixed** append order so dedup in `extract-archetypes.ts` stays deterministic).

---

## 5. Documentation and tooling checklist

1. **`docs/golden-archetypes.md`** — Add sections **23–26** (or renumber) with rule + rationale for each new archetype (mirror style of §1–22).
2. **`scripts/corpus-data/archetype-extractor.ts`** — Constants, metrics, classification, tests in `tests/compiler/archetype-extractor.test.ts`.
3. **`scripts/extract-archetypes.ts`** — No logic change if it only consumes `ARCHETYPE_ORDER`; confirm **golden-candidates** lists new sections.
4. **Regenerate** `scripts/corpus-data/archetypes.json` and `tests/compiler/fixtures/golden-candidates/golden-candidates.md` with `npm run extract:archetypes`; when the report changes, refresh OpenAPI pins under `golden-candidates/<archetype>/` with `npm run fixtures:copy-golden-specs` and ApiIR with `npm run fixtures:generate-apiir`; commit those fixture updates when archetypes change.
5. **Cross-link:** `docs/golden-archetypes.md` “See also” → this file.

---

## 6. Sequence relative to Phase 6

1. Implement **Track A** (this doc §3–5).
2. Pick **1–3 golden candidates per new archetype** from regenerated output for **manual** Phase 6 / mock checks.
3. Implement **Phase 6** (lowering, mock, UiPlan) with tests that reference those buckets.
4. **Track B** (optional): e.g. `scripts/archetype-coverage-report.ts` reading fixture ApiIR or merged JSON.

---

## 7. Subset v2 and scale

When **subset** widens:

1. Regenerate ApiIR fixtures → verify.
2. Re-run **pattern mining** (population drift).
3. Re-run **extract:archetypes** (classification drift).
4. **Diff** `archetypes.json` or golden-candidates for new archetype counts; **add** archetypes or thresholds if new IR features need new UI primitives.

This file is the **pre–Phase 6** gate for **listScoped-aware** regression naming; update it when you add or rename buckets.

---

## 8. Phase 6 linkage checklist (runtime targets)

Use this table to ensure Track A archetypes map to concrete runtime assertions in Phase 6
(lowering + mock + UiPlan). The goal is to avoid “classified but untested” buckets.

| Archetype                             | Lowering target                                                             | Mock target                                                           | UiPlan / prompt target                                                                  | Suggested assertion                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `list_scoped`                         | Treat `listScoped` as list-like for schema merge / table fields.            | Collection route returns scoped list data.                            | List view is produced (not detail-only).                                                | Resource with `listScoped` yields table/list UI primitives.                                  |
| `list_scoped_with_detail`             | `idField` inferred from response item schema, not scope param.              | Scope route and item route are both valid and distinct.               | Prompt language keeps `identifierParam` as scope context, row identity from item shape. | Scope id never used as row id; item route resolves by inferred id.                           |
| `list_scoped_only`                    | No synthetic row identity from `identifierParam`; `idField` may be absent.  | Item route (`/[paramId]`) returns 404 when no row id can be inferred. | Plan still emits list view; no forced detail requirement.                               | listScoped-only resource compiles with list UI; item fetch follows documented fallback.      |
| `required_query_list_like`            | List-like params include required query metadata for filter planning.       | Required query enforced or documented in mock behavior.               | Prompt/plan accounts for required query before load.                                    | Resource flagged by archetype also has `required_query_on_list=true` in UI readiness output. |
| `multiple_list_like_ops` _(optional)_ | Primary list-like precedence is deterministic (`list` before `listScoped`). | Seed/mock uses primary list-like op consistently.                     | List page source is stable when multiple list-like ops exist.                           | Same spec yields same chosen primary op across runs.                                         |

### Minimum pre-Phase 6 test set

Select at least **one fixture spec/resource per required archetype** (`list_scoped`,
`list_scoped_with_detail`, `list_scoped_only`, `required_query_list_like`) from regenerated
golden candidates or `archetypes.json`, then lock:

1. compile path (`buildApiIR` -> `llmPlan` -> `lower`) success,
2. expected view shape (list/table vs detail),
3. mock route semantics for scope vs row,
4. one negative/fallback assertion (`list_scoped_only` item route behavior).

---

## 9. Extract-archetypes smoke test vs full run

`tests/extract-archetypes.test.ts` runs the CLI with **`--limit 50`** and an ephemeral `--output-dir` (same shape as `extractArchetypesSmokeCliArgs`).

Loader behavior:

1. Load all ApiIR fixtures under `fixtures/apiir/valid-specs-github` and `valid-specs-api-guru`.
2. Build `specId` as `github/…` or `api-guru/…`, **sort globally** with `localeCompare`, then **`slice(0, 50)`**.

Because **`api-guru/…` sorts before `github/…`**, the first 50 specs are the **alphabetically first APIs.guru fixtures only** — not a balanced sample and not the full corpus.

For that slice, **many archetypes may have no matching specs**: the script can print `⚠ Archetype '…' has no matching specs` and `golden-candidates.md` in the temp output may show _\(no matching specs\)_ for some sections. **That is expected** for this speed-focused smoke: it only checks that the pipeline runs, JSON shape is valid, and the report still has **26 section headings** (`ARCHETYPE_ORDER.length`).

**For real candidate coverage**, use a **full** run (no `--limit`), e.g. default `npm run extract:archetypes`, and rely on the **committed** `tests/compiler/fixtures/golden-candidates/golden-candidates.md` plus `scripts/corpus-data/archetypes.json`.

**Optional** if temp output should look more like production without scanning the full corpus every time: raise `--limit`, run a full extract only in CI, or implement stratified sampling (extra effort).

---

## 10. Post–Phase 6 hardening (not required to _start_ Phase 6)

These items tighten **behavioral** confidence before calling a release “done”; they do **not** block beginning Phase 6 work.

| Item                      | Intent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`npm run eval:llm`**    | UiPlan is partly LLM-driven. After changes to `lib/compiler/uiplan/prompt.system.txt`, `prompt.user.ts`, or anything that materially changes planner input, run **`eval:llm`** once (or an agreed smaller spot-check). This is a **behavioral** regression check unit tests do not replace. Per the vNext plan: only tighten eval thresholds if you see real regressions; otherwise record the outcome in the PR.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`inferIdField` policy** | ARCHITECTURE / the pre-implementation gate say: infer **`idField` from list / listScoped item shape**; **`listScoped.identifierParam` is scope, not row id**; if nothing is inferable, **`idField` may be absent** and mock item behavior follows the documented fallback. **`lib/compiler/lowering/lower.ts`** may still fall back to the detail/update/delete **`identifierParam`** when the list body has no obvious top-level `id`. That can be valid when the row key really matches that param name, but it is **not** identical to a strict reading (“never use detail param unless the list item schema has that property”). A follow-up is: pick one rule (e.g. only use detail `identifierParam` when a list item property matches that name), add tests for **listScoped-only** + **non-id list items**, and align code or docs. |
| **Live / E2E smoke**      | Automated tests mock **`getCompilation`** and hit route handlers in isolation. Optionally load **one or two** specs from the committed golden list in a **running app** (Postgres + persisted compilation + browser) to catch wiring issues (slugs, mock adapter, store) that unit tests miss.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Summary:** sparse or warning-heavy output under `tests/tmp/extract-archetypes-smoke/` reflects **`--limit 50` + global sort**, not a broken extractor. Use full extract + committed golden artifacts for coverage. Schedule §10 before release, not necessarily before Phase 6 kickoff.
