---
name: Demo Prep UI and Specs
overview: "Implement demo-ready changes: new user+task demo specs (v1/v2/v3) with diff display, account-based compiler UI with spec list and detail view, and generated UI diff popup on first load after regeneration."
todos:
  - id: phase1-foundation
    content: "Phase 1: Foundation (accountId, store, pipeline). CHECKPOINT: accountId in localStorage, UUID ids, list/delete work."
    status: completed
  - id: phase2-diff
    content: "Phase 2: Multi-resource diff utilities. CHECKPOINT: computeMultiSpecDiff + formatMultiSpecDiffForDisplay work."
    status: completed
  - id: phase3-demo-specs
    content: "Phase 3: Demo specs and fixtures. CHECKPOINT: v1/v2/v3 compile, mock data works."
    status: completed
  - id: phase4-api
    content: "Phase 4: Compilations API. CHECKPOINT: list, get, delete, update routes work."
    status: completed
  - id: phase5-compiler-ui
    content: "Phase 5: Compiler UI layout. CHECKPOINT: spec list, detail view, URL param, update/delete."
    status: pending
  - id: phase6-diff-popup
    content: "Phase 6: Generated UI diff popup. CHECKPOINT: diff shows on load, button reopens."
    status: pending
  - id: phase7-polish
    content: "Phase 7: Polish. CHECKPOINT: banners, custom spec message."
    status: pending
isProject: false
---

# Demo Prep: Specs, Compiler UI, and Generated UI Diffs

**Reference:** [mvp_v3_dev_plan](.cursor/plans/mvp_v3_dev_plan_8f51c1e9.plan.md) (phase/checkpoint format)  
**Stress test:** [demo_prep_stress_test_analysis.md](demo_prep_stress_test_analysis.md)

---

## Phase 1: Foundation (accountId, Store, Pipeline)

**Goal:** Replace sessionId with accountId, UUID-based ids, and extend the store for account-based listing.

### Tasks

1. **getOrCreateAccountId** (`lib/session.ts`): Add `getOrCreateAccountId()` — read from `localStorage` key `rapidui_account_id`; if missing, generate UUID and persist. Keep `createSessionId` for backward compat if needed.
2. **CompilationEntry** (`lib/compiler/store.ts`): Extend with `accountId`, `name` (apiIr.api.title or first resource), `status: "success" | "failed"`, `errors?`, `diffFromPrevious?`.
3. **Store functions** (`lib/compiler/store.ts`): Add `listCompilationsByAccount(accountId)` — iterate `getStore().values()`, filter by `entry.accountId`, return `{ id, name, status }[]`. Add `deleteCompilation(id)` (idempotent: no-op if id missing).
4. **Pipeline** (`lib/compiler/pipeline.ts`): Replace `sessionId` with `id?: string`. When provided (update flow), use it; else `id = crypto.randomUUID().slice(0, 12)`. Remove hash-based id logic.
5. **Compile API** (`app/api/compile-openapi/route.ts`): Accept `accountId` in body (required; return 400 if missing). Remove `isGoldenSpec` check. Save entry with `accountId`, `name`, `status: "success"` (accountId used for store only; pipeline does not receive it).
6. **Compiler page** (`app/page.tsx`): Use `getOrCreateAccountId()` instead of `createSessionId()`. Pass `accountId` to compile API.
7. **Pipeline test** (`tests/compiler/pipeline.test.ts`): Remove `expect(r1.id).toBe(r2.id)` from determinism test (UUID ids differ); keep specs comparison.
8. **Cross-phase:** Verify all readers of `CompilationEntry` handle new optional fields (`accountId`, `name`, `status`, `diffFromPrevious`). Mock API and generated UI page only need `specs`, `apiIr`, `openapiCanonicalHash` — unchanged.

### File Summary


| File                               | Action                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| `lib/session.ts`                   | Add `getOrCreateAccountId`                                         |
| `lib/compiler/store.ts`            | Extend entry; add `listCompilationsByAccount`, `deleteCompilation` |
| `lib/compiler/pipeline.ts`         | id option, UUID                                                    |
| `app/api/compile-openapi/route.ts` | accountId, remove isGoldenSpec                                     |
| `app/page.tsx`                     | getOrCreateAccountId, pass accountId                               |
| `tests/compiler/pipeline.test.ts`  | Remove id assertion                                                |


### CHECKPOINT 1

- `getOrCreateAccountId()` returns same UUID across reloads (localStorage).
- New compile produces 12-char UUID id (not hash).
- Golden specs still compile. Custom spec (e.g. minimal valid OpenAPI) compiles (no 422).
- `listCompilationsByAccount(accountId)` returns saved specs. `deleteCompilation(id)` removes entry.

### Phase 1 Manual Testing

1. **Start dev server:** `npm run dev`
2. **accountId persistence:** Open compiler page → DevTools → Application → Local Storage → verify `rapidui_account_id` exists. Reload page → same value.
3. **Golden spec compile:** Drop `tests/compiler/fixtures/golden_openapi_users_tagged_3_0.yaml` → should succeed. Id in URL should be 12 alphanumeric chars (e.g. `a1b2c3d4e5f6`), not a hash. Requires `OPENAI_API_KEY` in `.env.local` (compiler uses real LLM).
4. **Custom spec compile:** Create minimal OpenAPI (e.g. `openapi: 3.0.3`, `info: { title: Test, version: 1 }`, one GET path with 200 response) → should compile (no 422). Previously would fail with "Only demo specs supported". Requires `OPENAI_API_KEY` (LLM generates plan).
5. **Generated UI:** After golden compile, click link to `/u/{id}/users` → table should load with mock data.
6. **API accountId required:** POST to `/api/compile-openapi` with `{ openapi: "..." }` but no `accountId` → 400 "Missing accountId". Add `accountId` to body → request proceeds.
7. **listCompilationsByAccount / deleteCompilation:** Exercised in Phase 4. For Phase 1, `npm run test` passes.

---

## Phase 2: Multi-Resource Diff Utilities ✅

**Goal:** Compute and format diffs between multi-resource UISpec maps for update flow and generated UI display.

### Tasks

1. **computeMultiSpecDiff** (`lib/spec/diff.ts`): Add `computeMultiSpecDiff(prevSpecs: Record<string, UISpec>, nextSpecs: Record<string, UISpec>)` returning `{ resourcesAdded, resourcesRemoved, resourceDiffs: Record<string, SpecDiff> }`. Use existing `computeSpecDiff` per resource.
2. **formatMultiSpecDiffForDisplay** (`lib/spec/diffFormatters.ts`): Add `formatMultiSpecDiffForDisplay(multiDiff)` producing `{ added: string[], removed: string[] }`. Return raw semantic strings (e.g. `"Task Management"`, `"department"`); UI component adds `++`/`--` when rendering. Page-level = resource/entity name; field-level = field names.
3. **Tests** (`tests/spec/diff.test.ts`): Add tests for `computeMultiSpecDiff` and `formatMultiSpecDiffForDisplay` (resource add/remove, field changes).

### File Summary


| File                         | Action                              |
| ---------------------------- | ----------------------------------- |
| `lib/spec/diff.ts`           | Add `computeMultiSpecDiff`          |
| `lib/spec/diffFormatters.ts` | Add `formatMultiSpecDiffForDisplay` |
| `tests/spec/diff.test.ts`    | Add multi-spec diff tests           |


### CHECKPOINT 2

- `computeMultiSpecDiff(prev, next)` returns correct `resourcesAdded`, `resourcesRemoved`, `resourceDiffs`.
- `formatMultiSpecDiffForDisplay` produces `{ added, removed }` with raw semantic strings (UI adds `++`/`--` when rendering).
- Tests pass.

---

## Phase 3: Demo Specs and Fixtures ✅

**Goal:** Create demo v1/v2/v3 OpenAPI specs and mock fixtures with all fields for all versions.

### Tasks

1. **Demo YAMLs** (`tests/compiler/fixtures/`): Create `demo_users_tasks_v1.yaml` (Users only), `demo_users_tasks_v2.yaml` (Users + Tasks), `demo_users_tasks_v3.yaml` (both updated). Base on golden specs and TEST_EXAMPLES. V1: users. V2: users + department, lastLoginAt, -role; tasks. V3: users + notes, -lastLoginAt; tasks + tags, -assigneeId, dueDate→dueAt.
2. **Demo fixtures** (`lib/compiler/mock/fixtures/`): Create `demo_users.json` and `demo_tasks.json` (or single combined) with all fields for v1/v2/v3. One dataset; API returns full data; UI filters by spec.
3. **getPredefinedData** (`lib/compiler/mock/fixtures.ts`): Extend to support multiple resources per hash. Key by `hash:resourceSlug` or nested map. Add demo v1/v2/v3 hashes.
4. **isPredefinedSpec** (`lib/compiler/mock/fixtures.ts`): Add `isPredefinedSpec(hash): boolean` — true for golden or demo hashes. Required for Phase 4 GET response (`isPredefined` field).
5. **compute-golden-hashes** (`scripts/compute-golden-hashes.ts`): Add demo spec paths. Run to get hashes; update fixtures.ts.
6. **LLM mock** (required): Add `tasksUiPlan(apiIr)` and extend `mockLlmPlan` in pipeline test to handle `Tasks` resource. Demo v2/v3 have Tasks; mock throws for unknown resources otherwise.

### File Summary


| File                                               | Action                                 |
| -------------------------------------------------- | -------------------------------------- |
| `tests/compiler/fixtures/demo_users_tasks_v1.yaml` | Create                                 |
| `tests/compiler/fixtures/demo_users_tasks_v2.yaml` | Create                                 |
| `tests/compiler/fixtures/demo_users_tasks_v3.yaml` | Create                                 |
| `lib/compiler/mock/fixtures/demo_users.json`       | Create (or extend users.json)          |
| `lib/compiler/mock/fixtures/demo_tasks.json`       | Create                                 |
| `lib/compiler/mock/fixtures.ts`                    | Add demo hashes, multi-resource lookup |
| `scripts/compute-golden-hashes.ts`                 | Add demo paths                         |


### CHECKPOINT 3

- Demo v1 compiles → Users only. Demo v2 → Users + Tasks. Demo v3 → both with updated fields.
- Mock API returns data for demo specs. Generated UI at `/u/{id}/users` and `/u/{id}/tasks` works.
- **fixtures:generate-apiir:** The script reads all `*.yaml` from `tests/compiler/fixtures/` (excl. invalid). Adding demo YAMLs to that folder auto-includes them — no script change. Run `npm run fixtures:generate-apiir` after adding demo YAMLs to refresh ApiIR JSON for evals.

---

## Phase 4: Compilations API ✅

**Goal:** List, get, delete, and update compilations via API.

### Tasks

1. **GET /api/compilations** (`app/api/compilations/route.ts`): Create. Query param `accountId` (required; return 400 if missing). Return `{ items: [{ id, name, status }] }` from `listCompilationsByAccount`.
2. **GET /api/compilations/[id]** (`app/api/compilations/[id]/route.ts`): Extend response with `apiIr`, `name`, `status`, `diffFromPrevious`, `isPredefined` (from `isPredefinedSpec(entry.openapiCanonicalHash)`). Require `accountId` query param (400 if missing). Verify ownership: if `entry.accountId !== accountId`, return 403.
3. **DELETE /api/compilations/[id]** (`app/api/compilations/[id]/route.ts`): Add DELETE export. Require `accountId` query param (400 if missing). Verify ownership (403 if mismatch). Call `deleteCompilation(id)`. Clear mock data for id. Return 204.
4. **POST /api/compilations/[id]/update** (`app/api/compilations/[id]/update/route.ts`): Create. Body `{ openapi: string, accountId: string }` (400 if accountId missing). Get existing entry; 404 if not found. Verify `entry.accountId === accountId` (403 if mismatch). Run pipeline with `id` (the compilation id from the URL). On failure: return 422 with errors; do not modify entry. On success: compute `computeMultiSpecDiff(prev, next)` → `formatMultiSpecDiffForDisplay` → store in `diffFromPrevious`. Clear mock, put compilation. Return 200.

### File Summary


| File                                        | Action                         |
| ------------------------------------------- | ------------------------------ |
| `app/api/compilations/route.ts`             | Create GET (list by accountId) |
| `app/api/compilations/[id]/route.ts`        | Extend GET; add DELETE         |
| `app/api/compilations/[id]/update/route.ts` | Create POST (update in place)  |


### CHECKPOINT 4

- `GET /api/compilations?accountId=xxx` returns list of specs for account.
- `GET /api/compilations/[id]?accountId=xxx` returns full entry including apiIr, name, diffFromPrevious, isPredefined.
- `DELETE /api/compilations/[id]` removes spec; GET list no longer includes it.
- `POST /api/compilations/[id]/update` with new OpenAPI replaces spec in place; same id/url; `diffFromPrevious` populated.

---

## Phase 5: Compiler UI Layout

**Goal:** New two-panel layout with spec list, detail view, URL param, update/delete.

### Tasks

1. **Layout** (`app/page.tsx`): Left panel = drop zone at top + spec list. Right panel = empty state or detail view. Replace current single-compile flow.
2. **URL param** (`app/page.tsx`): Use `?spec=id`. On load: read param, fetch list; if param id not in list (deleted or wrong account), clear param and show empty state. On spec click: `router.replace` with param. On list refresh: keep param; clear if spec deleted. After new compile: set param to new id.
3. **List fetch** (`app/page.tsx`): On mount and after compile/update/delete, fetch `GET /api/compilations?accountId=xxx`. Compiling state: for new compile, disable drop zone + toast "Compiling..."; on success, refresh list. For update, show loading on that list item. Pass `accountId` for all compilations API calls (list, get, delete, update).
4. **Detail fetch** (`app/page.tsx`): When spec selected, fetch `GET /api/compilations/[id]?accountId=xxx` for full details.
5. **Detail view** (`app/page.tsx`): Title, URL link, API endpoints list, compiler progress, Output Spec JSON, "Update spec" button (file picker).
6. **Delete** (`app/page.tsx`): Delete button per list item. Confirmation: "Are you sure you want to delete this?" On confirm: `DELETE /api/compilations/[id]?accountId=xxx`, re-fetch list.
7. **Update flow** (`app/page.tsx`): "Update spec" triggers hidden file input. On file select: read content, `POST /api/compilations/[id]/update` with `{ openapi, accountId }`. On success: re-fetch list, keep param.

### File Summary


| File           | Action                                              |
| -------------- | --------------------------------------------------- |
| `app/page.tsx` | New layout, list, detail, URL param, update, delete |


### CHECKPOINT 5

- Compiler page shows spec list (left) and detail (right).
- Upload new spec → appears in list; param set; detail shows.
- Click spec → param updates; detail fetches.
- Reload with `?spec=id` → same spec selected.
- Update spec → file picker → replace in place; list refreshes.
- Delete → confirm → spec removed; param cleared if deleted.

---

## Phase 6: Generated UI Diff Popup

**Goal:** Show diff popup on generated UI load when `diffFromPrevious` exists; button to reopen.

### Tasks

1. **Pass diff** (`app/u/[id]/[resource]/page.tsx`): Entry from `getCompilation(id)` includes `diffFromPrevious`. Pass to `CompiledUIContent`.
2. **CompiledUIContent** (`components/compiler/CompiledUIContent.tsx`): Add `diffFromPrevious?: { added: string[]; removed: string[] }` prop.
3. **Diff popup** (`components/compiler/CompiledUIContent.tsx`): When `diffFromPrevious` exists and not empty, show modal/dialog on mount. Title "What changed". Content: `++` items (green), `--` items (red). Use `sessionStorage` key `rapidui_diff_dismissed_${id}`: show once per compilation per browser session; if key set, skip auto-show (user can still reopen via "View changes").
4. **View changes button** (`components/compiler/CompiledUISidebar.tsx` or `CompiledUIContent`): Add "View changes" button when `diffFromPrevious` exists. Reopens diff popup.

### File Summary


| File                                        | Action                               |
| ------------------------------------------- | ------------------------------------ |
| `app/u/[id]/[resource]/page.tsx`            | Pass diffFromPrevious                |
| `components/compiler/CompiledUIContent.tsx` | diffFromPrevious prop, popup, button |
| `components/compiler/CompiledUISidebar.tsx` | Optional: "View changes" button      |


### CHECKPOINT 6

- Update a spec → visit generated UI → diff popup shows on first load (per session).
- "View changes" button reopens popup anytime.
- No diff (new spec) or empty diff → no popup, no button.

---

## Phase 7: Polish

**Goal:** Banners and custom spec messaging.

### Tasks

1. **Compiler banner** (`app/page.tsx`): Persistent message: "Custom specs are currently in development. You can use: Golden Users, Golden Products, or Demo (Users + Tasks v1 → v2 → v3)."
2. **Custom spec banner** (`app/page.tsx` or detail component): When detail fetch returns `isPredefined: false`, show "This is a custom spec. Experimental support." in detail view. (Uses `isPredefinedSpec` from Phase 3.)

### File Summary


| File           | Action                                                  |
| -------------- | ------------------------------------------------------- |
| `app/page.tsx` | Add banners, custom spec banner (isPredefined from GET) |


### CHECKPOINT 7

- Compiler page shows custom specs message.
- Selecting a custom spec shows experimental banner in detail view.

---

## Reference: Demo Spec Field Details

**V1:** Users only. id, email, profile.firstName, profile.lastName, status, role. Full CRUD.

**V2:** Users (+department, +lastLoginAt, -role) + Tasks (id, title, status, assigneeId, dueDate, priority).

**V3:** Users (+notes, -lastLoginAt). Tasks (+tags, -assigneeId, dueDate→dueAt).

**Mock:** One dataset, all fields. Key by `hash:resourceSlug` in getPredefinedData.

---

## Consolidated File Summary


| Phase | File                                               | Action                              |
| ----- | -------------------------------------------------- | ----------------------------------- |
| 1     | `lib/session.ts`                                   | Add `getOrCreateAccountId`          |
| 1     | `lib/compiler/store.ts`                            | Extend entry; list, delete          |
| 1     | `lib/compiler/pipeline.ts`                         | id option, UUID                     |
| 1     | `app/api/compile-openapi/route.ts`                 | accountId, remove isGoldenSpec      |
| 1     | `app/page.tsx`                                     | getOrCreateAccountId                |
| 1     | `tests/compiler/pipeline.test.ts`                  | Remove id assertion                 |
| 2     | `lib/spec/diff.ts`                                 | Add `computeMultiSpecDiff`          |
| 2     | `lib/spec/diffFormatters.ts`                       | Add `formatMultiSpecDiffForDisplay` |
| 2     | `tests/spec/diff.test.ts`                          | Multi-spec tests                    |
| 3     | `tests/compiler/fixtures/demo_users_tasks_v*.yaml` | Create v1, v2, v3                   |
| 3     | `lib/compiler/mock/fixtures/*.json`                | Demo users, tasks                   |
| 3     | `lib/compiler/mock/fixtures.ts`                    | Demo hashes, multi-resource         |
| 3     | `scripts/compute-golden-hashes.ts`                 | Add demo paths                      |
| 4     | `app/api/compilations/route.ts`                    | Create GET list                     |
| 4     | `app/api/compilations/[id]/route.ts`               | Extend GET, add DELETE              |
| 4     | `app/api/compilations/[id]/update/route.ts`        | Create POST update                  |
| 5     | `app/page.tsx`                                     | Full compiler UI                    |
| 6     | `app/u/[id]/[resource]/page.tsx`                   | Pass diffFromPrevious               |
| 6     | `components/compiler/CompiledUIContent.tsx`        | Diff popup, sessionStorage, button  |
| 7     | `lib/compiler/mock/fixtures.ts`                    | Add `isPredefinedSpec`              |
| 7     | `app/page.tsx`                                     | Banners, custom spec detection      |


---

## Cross-Phase Risks (Handle During Implementation)

### 1. Store Entry Shape Migration

Phase 1 extends `CompilationEntry` with `accountId`, `name`, `status`, `errors?`, `diffFromPrevious?`. **Action:** Ensure all readers handle new optional fields. Existing readers (mock API, generated UI page) only need `specs`, `apiIr`, `openapiCanonicalHash` — unchanged. New compilations API needs `accountId` for ownership. **Existing store entries:** In-memory store resets on restart; no migration needed. Old entries (pre-deploy) would have no `accountId` and won't appear in lists — acceptable.

### 2. Pipeline Options Change

Phase 1: Remove `sessionId`, add `id` option. Pipeline does not receive `accountId`; compile API uses it for store entry only. **Action:** Update all callers:

- `app/api/compile-openapi/route.ts` — does not pass accountId to pipeline; adds it when saving store entry
- `app/api/compilations/[id]/update/route.ts` (Phase 4) — pass `id` (compilation id from URL); `accountId` used for ownership verification only
- `tests/compiler/pipeline.test.ts` — no id option needed for determinism test
- Evals (`eval/utils/compile-openapi.ts`) — calls `compileOpenAPI(openapi, { source: "eval" })`; no sessionId today; will get random UUID; evals compare specs only, not id — no change needed

### 3. Compile API Response

Unchanged: `{ id, url, resourceNames, specs }`. Client (Phase 5) uses this to set param and refresh list.

### 4. Mock Store and Custom Specs

After removing `isGoldenSpec` check, custom specs compile. `getPredefinedData` returns null for unknown hashes → mock store uses `[]`. Custom spec UIs have empty tables. Acceptable for demo ("Experimental support").

---

## Implementation Notes

- **File picker:** Hidden `<input type="file" />` + button — same as [OpenApiDropZone](components/connect/OpenApiDropZone.tsx).
- **Spec keys:** `specs` uses resource slugs (`users`, `tasks`).

---

## Final Pre-Implementation Checklist

### Alignment verified


| Area                        | Status                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pipeline**                | Remove `sessionId`; add `id`. Id = `options.id` or `crypto.randomUUID().slice(0,12)`. Pipeline does not receive accountId.                           |
| **Evals**                   | `eval/utils/compile-openapi.ts` calls `compileOpenAPI(openapi, { source: "eval" })`; no sessionId. Evals compare specs only; random UUID id is fine. |
| **compute-golden-hashes**   | Script has hardcoded `FIXTURES` array; add 3 demo paths.                                                                                             |
| **fixtures:generate-apiir** | Reads all `*.yaml` from fixtures dir; demo YAMLs auto-included. No script change.                                                                    |
| **UISpec / diff types**     | `lib/spec/diff.ts` uses `UISpec` from `./schema`; `formatMultiSpecDiffForDisplay` will need `MultiSpecDiff` type (export from diff.ts).              |
| **Store comment**           | After Phase 1, update store.ts comment: id is no longer "first 12 chars of hash" — it's UUID.                                                        |


### No discrepancies

- Phase 2 checkpoint corrected: formatter returns raw strings; UI adds `++`/`--`.
- Phase 4: explicit 400 for missing `accountId` on GET/DELETE/update.
- Cross-phase: update route passes `id` only; `accountId` for ownership only.

### Code smell prevention

- **accountId everywhere:** All compilations API routes require `accountId`; client passes from `getOrCreateAccountId()`. Consistent.
- **diffFromPrevious shape:** `{ added: string[], removed: string[] }` — same as `FormatDiffResult` from diffFormatters. Reuse type.
- **isPredefinedSpec vs isGoldenSpec:** `isPredefinedSpec` = golden ∪ demo hashes. Keep `isGoldenSpec` if used elsewhere, or replace; ensure `getPredefinedData` and `isPredefinedSpec` share same hash set.
- **sessionStorage key:** `rapidui_diff_dismissed_${id}` — ensure `id` is safe (alphanumeric, 12 chars).

### Implementation order

Phases 1–7 are sequential. Phase 3 depends on Phase 2 (diff types) only if update flow uses them; Phase 4 depends on Phase 2 for `computeMultiSpecDiff`/`formatMultiSpecDiffForDisplay`. Phase 7 `isPredefinedSpec` can be done in Phase 3 (with fixtures) or Phase 7; recommend Phase 3 so GET response can include `isPredefined` in Phase 4.

---

## Open Questions

None at this time. Plan has been stress-tested and updated with recommendations.