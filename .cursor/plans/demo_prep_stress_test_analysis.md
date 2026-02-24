# Demo Prep Plan — Stress Test Analysis

**Plan:** [demo_prep_ui_and_specs_d616cbe6.plan.md](demo_prep_ui_and_specs_d616cbe6.plan.md)

This document stress-tests the implementation plan: gaps, edge cases, inconsistencies, and risks. **The plan has been updated with these recommendations.**

---

## Phase 1: Foundation

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **accountId validation** | Medium | Compile API: Plan says "Accept accountId in body" but doesn't specify behavior when missing. **Recommendation:** Require `accountId`; return 400 if absent. Client always has it via `getOrCreateAccountId()`. |
| **Failed compilations** | Low | Plan extends entry with `status: "success" \| "failed"` but compile API only saves on success. Failed compilations are never persisted. **Recommendation:** Either (a) don't persist failures (keep current behavior, status only for future use), or (b) add failed-entry persistence for "compilation history" — plan doesn't require it, so (a) is fine. |
| **Existing store entries** | Medium | Current `CompilationEntry` has no `accountId`. After Phase 1, `listCompilationsByAccount` filters by `entry.accountId`. Old entries (from before deploy) will have `accountId === undefined` and won't appear in any list. **Recommendation:** Document that server restart clears store (in-memory). No migration needed. If store is ever persisted, add migration. |
| **deleteCompilation idempotency** | Low | Plan doesn't say: does `deleteCompilation(id)` fail if id doesn't exist? **Recommendation:** Make idempotent (no-op if missing). Simpler. |
| **Pipeline test** | Done | Plan says remove `expect(r1.id).toBe(r2.id)` — but with UUID ids, same OpenAPI will now produce *different* ids each run (no sessionId). **Verify:** Pipeline uses `accountId` now; id = `crypto.randomUUID().slice(0,12)` when no `id` option. So r1.id !== r2.id always. Test should only assert `stringify(r1.specs) === stringify(r2.specs)`. |

### Cross-Cutting: accountId vs sessionId

- **Compile API** currently takes `sessionId`; plan switches to `accountId`. Ensure all callers (only `app/page.tsx`) are updated.
- **localStorage** key `rapidui_account_id`: works only in browser. `getOrCreateAccountId()` will be called from client. **SSR:** If any server code needs accountId, it won't have localStorage. Plan is client-only for accountId — OK.

---

## Phase 2: Multi-Resource Diff

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **formatMultiSpecDiffForDisplay output format** | Medium | Plan says "page-level (e.g. `++Task Management`) and field-level (`++fieldName`, `--fieldName`)". Unclear: (1) Is "Task Management" the entity name or resource display name? (2) Are `added` and `removed` flat arrays with `++`/`--` prefixes, or does the formatter add prefixes? **Recommendation:** Define: `added: ["Task Management", "department", "lastLoginAt"]` → display as `++Task Management`, `++department`, etc. Formatter or consumer adds `++`/`--`. |
| **Resource renames** | Low | If a resource is renamed (e.g. "Users" → "UserAccounts"), `computeMultiSpecDiff` would see it as removed + added. Plan doesn't handle renames specially. Acceptable for demo. |
| **Empty resourceDiffs** | Low | For resources that exist in both prev and next but have no changes, `resourceDiffs[slug]` would have empty arrays. `formatMultiSpecDiffForDisplay` should handle. |
| **SpecDiff import** | Low | `formatDiffForDisplay` in diffFormatters imports `SpecDiff` from `./diff`. `formatMultiSpecDiffForDisplay` will need the multi-diff type. Ensure types are exported. |

### formatMultiSpecDiffForDisplay Contract

Plan says: `{ added: string[], removed: string[] }` with `++`/`--` style. Two interpretations:

- **A:** Arrays contain raw strings; consumer adds `++`/`--` when rendering.
- **B:** Arrays contain `"++Task Management"`, `"--role"` etc.

**Recommendation:** A. Keep formatter returning semantic `added`/`removed`; UI component prefixes when rendering. Cleaner separation.

---

## Phase 3: Demo Specs and Fixtures

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **mockLlmPlan for Tasks** | High | `mockLlmPlan` in pipeline test throws for unknown resources. Demo v2/v3 have Tasks. **Required:** Add `tasksUiPlan(apiIr)` and extend `mockLlmPlan` to handle `Tasks`. Plan says "if needed" — it is needed for pipeline to compile demo specs. |
| **getPredefinedData multi-resource** | High | Current impl: `HASH_TO_DATA[hash]` → single array. Plan: "Key by `hash:resourceSlug` or nested map." So we need `Map<string, Record<string, unknown>[]>` or `Record<string, Record<string, Record<string, unknown>[]>>`. **Recommendation:** `HASH_TO_RESOURCE_DATA: Record<string, Record<string, unknown>[]>` keyed by `${hash}:${resourceSlug}` or nested `Record<hash, Record<resourceSlug, data[]>>`. |
| **Demo fixture fields** | Medium | "One dataset, all fields" — demo_users.json and demo_tasks.json must include every field across v1/v2/v3. V1 users: id, email, profile.*, status, role. V2 users: +department, +lastLoginAt, -role. V3 users: +notes, -lastLoginAt. So union of all = id, email, profile.*, status, department, lastLoginAt, notes. Tasks: id, title, status, assigneeId, dueDate, priority, tags, dueAt. Records need all; UI shows only spec-defined fields. |
| **isGoldenSpec vs demo** | Medium | Plan removes `isGoldenSpec` check from compile API. So custom specs compile. But `getPredefinedData` returns null for unknown hashes → mock store gets `[]`. Custom specs will have empty tables until we add seed generation. Plan says "Custom specs... Experimental support" — empty data is acceptable for demo. |
| **compute-golden-hashes** | Low | Script must add 3 demo paths. Output hashes go into fixtures.ts. Run after creating YAMLs. |
| **fixtures:generate-apiir** | Resolved | Script reads all `*.yaml` from `tests/compiler/fixtures/` (excl. invalid). Adding demo YAMLs auto-includes them. No script change needed. |

### Demo YAML → Hash → Fixture Flow

1. Create demo v1/v2/v3 YAMLs.
2. Run `compute-golden-hashes.ts` (with demo paths added).
3. Create demo_users.json, demo_tasks.json with all fields.
4. Update fixtures.ts: add 3 hashes, extend getPredefinedData for `hash:users` and `hash:tasks` per demo hash.

---

## Phase 4: Compilations API

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **GET /api/compilations without accountId** | Medium | Plan: "Query param accountId". If missing? **Recommendation:** Return 400. |
| **Account isolation** | High | `GET /api/compilations/[id]` and `DELETE` do not check accountId. Any user with an id can read/delete any compilation. **Recommendation:** Add accountId check: GET/DELETE/update should verify `entry.accountId === requestAccountId` (from query/header/body). Return 403 or 404 if mismatch. Plan doesn't mention this — security gap. |
| **POST update failure** | Medium | "On success: compute diff..." — what about pipeline failure? **Recommendation:** Return 422 with errors. Don't modify entry. |
| **POST update — entry not found** | Medium | "Get existing entry" — if id doesn't exist, return 404. |
| **POST update — accountId** | High | Update route needs accountId to verify ownership. Body or header? **Recommendation:** `accountId` in body or `X-Account-Id` header. |
| **clearForCompilation + putCompilation order** | Low | Plan: "Clear mock, put compilation". Order: clear first, then put. Correct — ensures mock store re-initializes with new predefined data if hash changed. |

### API Contract Summary

| Route | accountId | On missing id | On wrong account |
|-------|-----------|---------------|------------------|
| GET /api/compilations | Required (query) | N/A | N/A |
| GET /api/compilations/[id] | Optional (verify ownership) | 404 | 403/404 |
| DELETE /api/compilations/[id] | Optional (verify ownership) | 404 | 403/404 |
| POST .../update | Required (body/header) | 404 | 403/404 |

---

## Phase 5: Compiler UI Layout

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **Empty list state** | Low | When account has no compilations: show empty state in left panel. "Upload a spec to get started." Plan implies this. |
| **Empty detail state** | Low | When no spec selected (e.g. cleared param): right panel shows "Select a spec or upload one." |
| **Compiling state** | Medium | "Show loading/compiling (during POST) per item." For *new* compile: no item yet. Options: (a) optimistic "Compiling..." placeholder in list, (b) disable drop zone + toast "Compiling...", (c) show progress in right panel. **Recommendation:** Toast + disabled drop zone; on success, refresh list and add item. Simpler. For *update*: that item shows loading. |
| **URL param race** | Low | User has ?spec=id. They delete that spec. Plan: "clear if spec deleted." So after delete, `router.replace` to remove param. |
| **URL param — invalid id** | Medium | User bookmarks ?spec=abc123. They return later; that id was deleted or from another account. On load: fetch list, if selected id not in list, clear param and show empty state. |
| **Detail view — Output Spec JSON** | Low | Compilation has multiple specs (Record<resourceSlug, UISpec>). Show full `specs` object or per-resource tabs? Plan says "Output Spec JSON" — likely full object. |
| **Detail view — compiler progress** | Low | For existing (already compiled) spec: show "Success" or static state. For update in progress: show steps. |
| **New compile endpoint** | Clarify | New spec = POST /api/compile-openapi (existing). Body: `{ openapi, accountId }`. Returns `{ id, url, resourceNames, specs }`. Client then fetches list and sets param. |

### Layout Complexity

- Left: drop zone + scrollable list. List can grow. Consider max-height + scroll.
- Right: detail or empty. Detail has multiple sections (title, URL, endpoints, progress, JSON, Update button). Consider responsive behavior on narrow screens.

---

## Phase 6: Generated UI Diff Popup

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **diffFromPrevious shape** | Low | Plan: `{ added: string[], removed: string[] }`. Matches `formatMultiSpecDiffForDisplay` output. Good. |
| **Show every load** | Medium | "Show every load (no dismiss flag)." User visits /u/id/users, sees popup, dismisses. They navigate to /u/id/tasks — popup shows again. They go back to users — popup again. Could be annoying. **Recommendation:** Consider sessionStorage key `rapidui_diff_dismissed_${id}` so we show once per compilation per session. Plan says "every load" — follow plan for demo; can relax later. |
| **"View changes" button placement** | Low | Plan: "CompiledUISidebar or CompiledUIContent". Sidebar is shared across resources; diff is per-compilation. So button in sidebar (when diff exists) makes sense. Clicking reopens popup. |
| **Resource-specific diff** | Medium | `diffFromPrevious` is multi-resource (added/removed across all resources). When viewing /u/id/users, do we show full diff or filter to Users-related items? Plan doesn't specify. **Recommendation:** Show full diff — "What changed" is compilation-level. Simpler. |
| **Empty diff** | Low | If `diffFromPrevious` is `{ added: [], removed: [] }`, don't show popup. Plan: "No diff (new spec) → no popup, no button." So we also need to not show when both arrays empty. |

---

## Phase 7: Polish

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **Predefined set detection** | Medium | "When selected spec is not in predefined set (golden + demo)" — how do we know? Options: (a) compare `openapiCanonicalHash` to known hashes, (b) store `isPredefined: boolean` at compile time. **Recommendation:** (a). We have golden + demo hashes in fixtures. Add `isPredefinedSpec(hash): boolean` (or extend `isGoldenSpec` to `isPredefinedSpec` including demo hashes). |
| **Banner persistence** | Low | "Persistent message" — always visible on compiler page. Fine. |

---

## Cross-Phase Risks

### 1. Store Entry Shape Migration

Phase 1 extends `CompilationEntry` with `accountId`, `name`, `status`, `errors?`, `diffFromPrevious?`. All code that reads `getCompilation` or `putCompilation` must handle the new shape. Current readers:

- `app/api/compile-openapi/route.ts` — puts entry
- `app/api/compilations/[id]/route.ts` — gets entry
- `app/api/mock/[id]/[resource]/route.ts` — gets entry (needs specs, apiIr, openapiCanonicalHash)
- `app/api/mock/[id]/[resource]/[paramId]/route.ts` — same
- `app/u/[id]/[resource]/page.tsx` — gets entry

None of these currently need accountId except the new compilations API. Ensure backward compat: new fields are optional for existing reads.

### 2. Pipeline Options Change

Phase 1: `sessionId` → `accountId`, add `id`. Pipeline `compileOpenAPI` signature changes. Callers:

- `app/api/compile-openapi/route.ts`
- `app/api/compilations/[id]/update/route.ts` (new)
- `tests/compiler/pipeline.test.ts`
- Possibly evals

Verify all call sites.

### 3. Compile API Response

Current response: `{ id, url, resourceNames, specs }`. Plan doesn't change it. Client (Phase 5) will use this to set param and refresh list. Good.

### 4. Mock Store and Custom Specs

After removing `isGoldenSpec` check, custom specs compile. `getPredefinedData` returns null for unknown hashes → mock store uses `[]`. So custom spec UIs will have empty tables. Plan accepts this ("Experimental support"). No seed generation in scope.

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| High | Add accountId ownership checks to GET/DELETE/update compilations |
| High | Add Tasks to mockLlmPlan for demo v2/v3 |
| High | Define accountId as required in compile API; 400 if missing |
| Medium | Define formatMultiSpecDiffForDisplay contract (prefixed vs raw) |
| Medium | Handle POST update pipeline failure (422) |
| Medium | Clarify GET /api/compilations without accountId (400) |
| Low | Make deleteCompilation idempotent |
| Low | Consider sessionStorage for diff popup "show once per session" (optional) |

---

## Test Checklist (Manual / E2E)

1. **Phase 1:** Compile golden spec → new UUID id; reload page → same accountId; list returns items; delete removes.
2. **Phase 2:** Unit tests for computeMultiSpecDiff + formatMultiSpecDiffForDisplay.
3. **Phase 3:** Compile demo v1, v2, v3; visit /u/id/users and /u/id/tasks; data appears.
4. **Phase 4:** List with wrong accountId → empty. Get/delete/update with wrong accountId → 403/404.
5. **Phase 5:** Upload → list updates; select → detail; delete → param clears; update → in-place.
6. **Phase 6:** Update spec → visit UI → diff popup; "View changes" reopens.
7. **Phase 7:** Custom spec → experimental banner.
