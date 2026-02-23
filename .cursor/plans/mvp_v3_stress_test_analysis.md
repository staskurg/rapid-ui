# MVP v3 Dev Plan — Stress Test Analysis

Analysis of the implementation plan for discrepancies, gaps, and improvement opportunities.

---

## Critical Discrepancies

### 1. Compiler Page vs Legacy Modes (Demo/External/Paste) — RESOLVED

**Issue:** Plan said "two-panel compiler layout" and "Demo/External/Paste flows unchanged." Conflict.

**Resolution:** Completely remove Demo, External, and Paste. Main page (`/`) is compiler-only. Delete legacy code: demo store, adapters, proxy, generate-ui, connect components, examples. No legacy pollution.

---

### 2. Resource Name vs URL Slug — RESOLVED

**Resolution:** `resourceSlug = slugify(resourceName)`. Store `resourceSlugs` in compilation. Use slugs for URLs and mock API; use names for sidebar labels.

---

### 3. idField Per Resource — RESOLVED

**Resolution:** Mock API uses `specs[resourceSlug].idField` for ID generation and lookups.

---

### 4. Nested Form Data (Flatten/Unflatten) — RESOLVED

**Resolution:** Add `flattenRecord`/`unflattenRecord` utils. Wire flatten for FormModal initialValues, unflatten in onSubmit before adapter.create/update.

---

### 5. Array Fields in UISpec — RESOLVED

**Resolution:** Exclude array-of-primitive fields from lowering for MVP. Document in `lib/compiler/lowering/README.md` for future array support.

---

## Moderate Gaps

### 6. Mock API HTTP Method for Update — RESOLVED

**Resolution:** Mock API accepts both PUT and PATCH. MockAdapter uses method from available ops (prefer PATCH if both exist).

---

### 7. JSON Schema 3.1 Nullable — RESOLVED

**Resolution:** schema-to-field and seed-generator handle `type: ["string", "null"]`. Seed gen emits null sometimes; UISpec field stays "string".

---

### 8. External $ref Validation Stage — RESOLVED

**Resolution:** Phase 1 subset validator scans for external $ref (http, https, file); ref-resolver in Phase 2 is second line of defense.

---

### 9. Phase 7 Test File Inconsistency — RESOLVED

**Resolution:** Added uiplan.test.ts and lowering.test.ts to Phase 7.

---

### 10. Success Criteria Outdated — RESOLVED

**Resolution:** Updated to "seeded data and full CRUD."

---

## Minor Improvements

### 11. pipeline.ts Placement — RESOLVED

**Resolution:** Documented in plan: pipeline orchestrates parse → validate → canonicalize → apiir → llm → normalize → lower. Each stage is pure; pipeline wires in order.

---

### 12. OPENAI_API_KEY — RESOLVED

**Resolution:** Use env variable only. Never hardcode or log. Read from `process.env.OPENAI_API_KEY`. Missing → UIPLAN_LLM_UNAVAILABLE. Documented in Environment & API Keys section.

---

### 13. Seed Generator — Nested $ref — RESOLVED

**Resolution:** Seed generator recursively generates for nested objects. ApiIR has resolved schemas (no $ref).

---

### 14. Hash Collision (Low Risk) — RESOLVED

**Resolution:** Documented in plan: 12 chars = 48 bits, sufficient for MVP.

---

### 15. 404 on Stale /u/[id] — RESOLVED

**Resolution:** Generated UI page shows: "This UI is no longer available. Re-upload the OpenAPI spec to regenerate." when fetch returns 404.

---

## Dependency Order Check

| Phase | Depends On | Blockers |
|-------|------------|----------|
| 1 | None | — |
| 2 | 1 (parser output) | — |
| 3 | 2 (canonical OpenAPI) | — |
| 4 | 3 (ApiIR) | — |
| 5 | 4 (UiPlanIR) | — |
| 6 | 1–5, pipeline | All stages |
| 7 | 1–6 | Full pipeline for E2E |

Order is correct. Phase 6 can be parallelized internally: store, mock, API routes, UI page.

---

## Summary — All Resolved

All 15 items have been incorporated into the dev plan. See the plan for full details.
