# Postgres Storage Migration — Stress Test Analysis

**Plan:** [postgres_storage_migration_f9b9558d.plan.md](postgres_storage_migration_f9b9558d.plan.md)

This document stress-tests the migration plan: gaps, edge cases, inconsistencies, and risks. **Recommendations should be folded into the plan before implementation.**

---

## Phase 1: Compilation Store → Postgres

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **Async interface change** | High | Current store is **synchronous** (`getCompilation(id): CompilationEntry \| undefined`). Postgres drivers are async. **Impact:** All 5 store functions must become async. **Callers to update:** `app/api/compile-openapi/route.ts`, `app/api/compilations/route.ts`, `app/api/compilations/[id]/route.ts`, `app/api/compilations/[id]/update/route.ts`, `app/api/mock/[id]/[resource]/route.ts`, `app/api/mock/[id]/[resource]/[paramId]/route.ts`, `app/u/[id]/page.tsx`, `app/u/[id]/[resource]/page.tsx`. All are already in async contexts (API handlers, Server Components). **Recommendation:** Change store to `getCompilation(id): Promise<CompilationEntry \| undefined>`; all callers add `await`. |
| **putCompilation createdAt preservation** | Medium | Current: `createdAt: existing?.createdAt ?? now`. Postgres upsert must preserve `created_at` on conflict. **Recommendation:** `ON CONFLICT (id) DO UPDATE SET ... created_at = compilations.created_at` (explicitly keep existing) or `EXCLUDED.created_at` only on INSERT. |
| **Env var naming** | Low | Plan mentions both `POSTGRES_URL` and `DATABASE_URL`. Neon Vercel integration typically injects `POSTGRES_URL` or `DATABASE_URL`. **Recommendation:** Check both: `process.env.POSTGRES_URL ?? process.env.DATABASE_URL`. Document in plan. |
| **Postgres only (no fallback)** | Resolved | Plan updated: remove in-memory fallback entirely. App always uses Postgres. Local dev and CI require a Postgres instance. |
| **Error handling** | Medium | Plan does not specify behavior when Postgres is unreachable (network error, timeout, connection refused). **Recommendation:** Catch DB errors in data layer; surface as 500 to API callers. For `getCompilation` in page components, consider redirect to error state or retry. |
| **hasCompilation** | Resolved | Implement in Postgres layer (decided). |
| **JSON serialization** | Low | `specs`, `apiIr`, `diffFromPrevious`, `errors` go to JSONB. JavaScript `undefined` is omitted by `JSON.stringify`; `null` is preserved. Ensure no `undefined` in nested objects that must round-trip. Current types use optional fields; typically fine. |
| **Neon connection string** | Low | Neon provides pooled (`-pooler` in host) vs direct URLs. For serverless, use pooled. Vercel integration typically provides the correct one. **Recommendation:** Verify we use pooled URL when available. |

### Schema Validation

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(12) | `crypto.randomUUID().slice(0,12)` — correct |
| account_id | VARCHAR(36) | UUID from localStorage — correct |
| openapi_canonical_hash | VARCHAR(64) | SHA-256 hex — correct |
| name | VARCHAR(255) | apiIr.api.title — sufficient |
| status | VARCHAR(20) | "success", "failed" — sufficient |

### Caller Audit (must add `await`)

| File | Function | Change |
|------|----------|--------|
| `app/api/compile-openapi/route.ts` | putCompilation | `await putCompilation(...)` |
| `app/api/compilations/route.ts` | listCompilationsByAccount | `await listCompilationsByAccount(...)` |
| `app/api/compilations/[id]/route.ts` | getCompilation (2x), deleteCompilation | `await` on each |
| `app/api/compilations/[id]/update/route.ts` | getCompilation, putCompilation | `await` on each |
| `app/api/mock/[id]/[resource]/route.ts` | getCompilation (2x) | `await` on each |
| `app/api/mock/[id]/[resource]/[paramId]/route.ts` | getCompilation | `await` |
| `app/u/[id]/page.tsx` | getCompilation | `await getCompilation(id)` |
| `app/u/[id]/[resource]/page.tsx` | getCompilation | `await getCompilation(id)` |

---

## Phase 2: Mock Data Store → Postgres (Deferred)

*Phase 2 deferred. Mock store stays in-memory. Below for reference when implementing later.*

### Gaps & Edge Cases

| Issue | Severity | Description |
|-------|----------|-------------|
| **Async interface change** | High | Same as Phase 1. `getRecords`, `createRecord`, `updateRecord`, `deleteRecord`, `getById`, `clearForCompilation` must become async. **Callers:** `app/api/mock/[id]/[resource]/route.ts` (getRecords, createRecord), `app/api/mock/[id]/[resource]/[paramId]/route.ts` (getById, updateRecord, deleteRecord), `app/api/compilations/[id]/route.ts` (clearForCompilation). All async. **Recommendation:** Same pattern — always async interface. |
| **getOrCreateResource race** | Medium | Two concurrent requests for same (accountId, dataKey, resourceSlug) may both see no row. **Recommendation:** `INSERT ... ON CONFLICT (account_id, data_key, resource_slug) DO NOTHING` then `SELECT`. First wins; second's INSERT no-ops; both SELECT and get the row. |
| **createRecord / updateRecord / deleteRecord race** | Low | Read-modify-write of `records` JSONB. Two concurrent creates could both read same array, both append, both write — last write wins, one record lost. **Recommendation:** Acceptable for demo. For robustness, use `SELECT ... FOR UPDATE` in a transaction. Out of scope for initial migration. |
| **clearForCompilation — data_key** | Medium | Plan: "DELETE WHERE account_id = ? AND data_key = ?". For custom specs, `data_key = compilationId`. Correct. For predefined, we skip (no delete). **Verify:** `isPredefinedSpec(hash)` check happens before any delete. |
| **data_key length** | Low | `dataSourceId` = "golden_users", "golden_products", "demo" (~20 chars). `compilationId` = 12 chars. VARCHAR(64) sufficient. |
| **Fixture import in DB layer** | Low | `getOrCreateResource` needs `getPredefinedDataForDataSource` from fixtures. DB layer will import from `@/lib/compiler/mock/fixtures`. No circular dependency (fixtures doesn't import store). |
| **list_schema and id_field** | Low | Stored per row. When we SELECT, we get them back. Used for timestamp paths and idField. Good. |

### clearForCompilation Logic

Current: iterate keys, delete those matching `accountId:compilationId:*`. For Postgres: `DELETE FROM mock_data WHERE account_id = $1 AND data_key = $2` with `data_key = compilationId`. Only called when `!isPredefinedSpec(hash)`, so we never delete predefined shared data. Correct.

---

## Cross-Phase Risks

### 1. Store Interface Breaking Change

Both stores change from sync to async. This is a **breaking change** for any code that imports and calls them. Grep confirmed all callers are in async contexts. **Action:** Update plan to explicitly list "Change all store functions to async; add await at all call sites."

### 2. Postgres Only (No Fallback)

Plan updated: no in-memory fallback. Both stores always use Postgres. Local dev and CI need a Postgres instance.

### 3. Phase 2 Depends on Phase 1

Mock store's `getOrCreateResource` needs `getCompilation` only indirectly — it receives `accountId`, `compilationId`, `openapiCanonicalHash` from the mock API route, which gets the entry via `getCompilation`. So mock API route calls compilation store. If Phase 1 is done, compilation store is async. Mock API already awaits getCompilation. When we add Phase 2, mock store becomes async; mock API will await mock store calls. No circular dependency.

### 4. Tests and CI

- Pipeline tests: don't use store. No change.
- Tests run locally only for now. No CI Postgres setup.

### 5. Evals

Evals call `compileOpenAPI` only; no store. No change.

### 6. Rollback Strategy

With Postgres-only, there is no fallback. If Postgres has issues: fix DB or connection. No in-memory escape hatch. Document DB as critical dependency.

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| High | Change store interface to async; add `await` at all 8+ call sites |
| High | Preserve `created_at` on upsert in putCompilation |
| Resolved | Postgres only; no fallback (plan updated) |
| Medium | Add error handling for DB unreachable (500, log) |
| Medium | Support both `POSTGRES_URL` and `DATABASE_URL` |
| Low | Verify Neon pooled connection string for serverless |
| Resolved | Implement `hasCompilation` in Postgres layer |

---

## Test Checklist (Manual / E2E)

### Phase 1

1. **Local with DB:** Set `POSTGRES_URL` or `DATABASE_URL` → compile → restart dev server → list still shows compilation; get returns it.
3. **Update flow:** Compile → update spec → same id; diffFromPrevious populated.
4. **Delete:** Delete compilation → list no longer includes it; get returns 404.
5. **Wrong account:** list with accountId B when compilations belong to A → empty list. get with wrong accountId → 403.
6. **Page load:** Visit `/u/{id}/users` → loads. Restart server → still loads (Postgres).

### Phase 2

1. **Predefined data:** Compile demo v2 → visit /u/id/users → records from fixtures. Create record → persists. Restart → records still there.
2. **Custom spec:** Compile custom spec → create record → restart → records gone (custom uses compilationId; if we didn't persist mock, in-memory loses it). With Postgres: records persist.
3. **clearForCompilation:** Delete custom compilation → mock data for that id cleared. Predefined: delete one compilation of demo spec → other compilations of same spec still have data (shared by dataSourceId).
4. **Concurrent getOrCreate:** Two simultaneous first requests for same resource → both succeed; no duplicate rows.
