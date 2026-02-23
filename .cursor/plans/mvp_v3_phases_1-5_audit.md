# MVP v3 Phases 1–5 Implementation Audit

Audit date: 2025-02-20. Cross-check of plan requirements vs codebase.

---

## Phase 1: OpenAPI Ingestion & Subset Validator

| Requirement | Status | Notes |
|-------------|--------|-------|
| Parser: YAML + JSON, detect 3.0 vs 3.1 | ✅ | `lib/compiler/openapi/parser.ts` |
| Subset validator with `{ code, stage, message, jsonPointer }` | ✅ | `lib/compiler/openapi/subset-validator.ts` |
| Error taxonomy (all codes) | ✅ | `lib/compiler/errors.ts` — includes OAS_CIRCULAR_REF |
| oneOf/anyOf/allOf → hard error | ✅ | `checkSchemaRecursive` |
| Multiple success (200+201) → error | ✅ | `validateSubset` |
| Missing request body on POST/PUT/PATCH → error | ✅ | `METHODS_REQUIRING_BODY` |
| Multiple path params → error | ✅ | `extractPathParams`, Subset stage |
| External $ref → error | ✅ | `ref-resolver.ts` (Canonicalize stage) |
| OpenApiDropZone: .yaml, .yml, .json, click-to-browse | ✅ | `components/connect/OpenApiDropZone.tsx` |
| Two-panel layout: left drop+spec, right progress | ✅ | `app/page.tsx` |
| Legacy removal | ✅ | demoStore, inference, demo/external adapters, generate-ui, proxy, examples, etc. removed |

**CHECKPOINT 1:** ✅ invalid spec fails with expected errors; Users + Products pass. `invalid.test.ts` asserts codes and same-ordered errors.

**Minor:** Error taxonomy table lists OAS_MULTIPLE_PATH_PARAMS as ApiIR stage; implementation uses Subset. Fail-fast is acceptable.

---

## Phase 2: Canonicalization & Hashing

| Requirement | Status | Notes |
|-------------|--------|-------|
| $ref resolver: local only, inline, reject external | ✅ | `lib/compiler/openapi/ref-resolver.ts` |
| Canonicalizer: stable key/array ordering | ✅ | `lib/compiler/openapi/canonicalize.ts` |
| Hashing: sha256 of canonical JSON | ✅ | `lib/compiler/hash.ts` |
| fast-json-stable-stringify | ✅ | In package.json, used in hash + canonicalize |

**CHECKPOINT 2:** ✅ `canonical.test.ts` — same spec → same canonical JSON → same hash. Circular ref test present.

---

## Phase 3: OpenAPI → ApiIR

| Requirement | Status | Notes |
|-------------|--------|-------|
| ApiIR types | ✅ | `lib/compiler/apiir/types.ts` |
| Resource grouping: tag or path-based | ✅ | `lib/compiler/apiir/grouping.ts` |
| Operation mapping: list/detail/create/update/delete | ✅ | `lib/compiler/apiir/operations.ts` |
| identifierParam for detail/update/delete | ✅ | `inferKind` |
| ApiIR builder, byte-stable | ✅ | `lib/compiler/apiir/build.ts` |
| apiIrHash | ✅ | `sha256Hash(apiIr)` |
| slugify utility | ✅ | `lib/utils/slugify.ts` |

**CHECKPOINT 3:** ✅ `apiir.test.ts` — golden specs → ApiIR snapshot. Ambiguous grouping → error.

---

## Phase 4: LLM Planning (ApiIR → UiPlanIR)

| Requirement | Status | Notes |
|-------------|--------|-------|
| UiPlanIR schema (JSON + Zod) | ✅ | `uiplan.schema.json`, `uiplan.schema.ts` |
| label optional, no minLength | ✅ | `label: z.string().optional()` |
| System prompt | ✅ | `prompt.system.txt` |
| User prompt with `<API_IR_JSON_HERE>` | ✅ | `prompt.user.ts` |
| OPENAI_API_KEY check → UIPLAN_LLM_UNAVAILABLE | ✅ | `llm-plan.ts` |
| temperature: 0, response_format: json_object | ✅ | |
| Retry max 2 on validation failure | ✅ | `MAX_RETRIES = 2` |
| Optional source param for metrics | ✅ | `options?.source` |
| Optional llmPlanFn for tests | ✅ | |
| Normalizer: sort resources, views, dedupe fields | ✅ | `normalize.ts` |
| stripUndefined: preserve false and 0 | ✅ | |
| formatZodError | ✅ | `format-errors.ts` |
| uiPlanHash | ✅ | `sha256Hash(normalized)` |

**CHECKPOINT 4:** ✅ `uiplan.test.ts` — mock LLM, snapshot, determinism, UIPLAN_LLM_UNAVAILABLE when no key.

---

## Phase 5: Lowering (UiPlanIR → UISpec)

| Requirement | Status | Notes |
|-------------|--------|-------|
| lower.ts: one UISpec per resource | ✅ | `lib/compiler/lowering/lower.ts` |
| Map ViewPlan → Field[] (name, label, type, required, options) | ✅ | `schemaToField` |
| table.columns = list view paths | ✅ | |
| form.fields = create + edit merged/deduplicated | ✅ | `mergeFormFields` |
| filters = list string/number (and enum) | ✅ | `filterableTypes` |
| Schema type inference from ApiIR | ✅ | `schema-to-field.ts`, `extractSchemaFields` |
| Stable IDs (viewId, fieldId) | ⚠️ | Plan: "Use for deterministic ordering if needed." Not implemented. Ordering achieved via sort by order+path. Acceptable per "if needed." |
| idField: prefer id if in schema | ✅ | `inferIdField` |
| flattenRecord / unflattenRecord | ✅ | `lib/utils/flattenRecord.ts`, `unflattenRecord.ts` |
| Array-of-primitive excluded | ✅ | `collectFields` returns early for array of primitives |
| Output Record&lt;slug, UISpec&gt;, validate each | ✅ | `UISpecSchema.parse` |
| readOnly wired through | ✅ | UISpec Field, schemaToField, FormModal disabled |
| PUT vs PATCH preference for edit | ✅ | sortOperations: PATCH before PUT (method sort) |

**CHECKPOINT 5:** ✅ `lowering.test.ts` — Users, Products fixtures, determinism, snapshots. Each UISpec validated.

---

## Gaps and Recommendations

### Implemented but worth double-checking

1. **OAS_MULTIPLE_PATH_PARAMS stage** — Plan table says ApiIR; code uses Subset. No change needed; early validation is preferable.

### Optional / deferred

1. **viewId / fieldId** — Plan says "if needed." Current ordering is deterministic without them. Can add later if required for React keys or references.

### Not yet in scope (Phase 6+)

- Pipeline (`lib/compiler/pipeline.ts`)
- Compilation store, mock backend, compile API
- Generated UI page, CompiledUISidebar
- `pipeline.test.ts` (Phase 7)
- Eval harness update (Phase 7)

---

## Summary

**Phases 1–5:** All required tasks are implemented. No dropped requirements. CHECKPOINTs 1–5 are satisfied. Legacy removal is complete. Stable IDs (viewId/fieldId) are optional per plan and not implemented; ordering is deterministic via sort.
