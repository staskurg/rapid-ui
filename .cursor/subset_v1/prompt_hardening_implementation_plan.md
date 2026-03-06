# Prompt Hardening Implementation Plan

**Context:** ChatGPT analyzed the system prompt and produced recommendations for deterministic, production-grade reliability. This document reviews each recommendation against our codebase, determines applicability, and prioritizes implementation.

**Current state:** Evals pass (100% similarity in latest run). The prompt works for v1–v3 + golden specs. Goal: future-proof against schema complexity and model drift.

---

## 1. Recommendation Review: Apply vs Omit

### ✅ APPLY — High Priority

| # | Recommendation | Why it applies |
|---|----------------|----------------|
| **B** | **Update operation precedence (PATCH over PUT)** | ApiIR for v2 has BOTH `patchTask` and `updateTask` (and same for Users). The prompt says "edit → update operation requestSchema" but doesn't specify which. Lower layer uses `find(kind="update")` which returns first by sort order (PATCH before PUT). We must align the prompt so the LLM picks PATCH deterministically. |
| **C** | **Identifier exclusion rule (identifierParam)** | Products uses `sku` as identifier, not `id`. Current exclusion is hardcoded: `id, createdAt, updatedAt`. We need: "If `operation.identifierParam` exists as a top-level property (e.g. `sku`), exclude it from list/detail like `id`." |
| **D** | **Entity matching strictly (exact, no substring)** | Current: "when resource name matches (case-insensitive)" — ambiguous. "AdminUsers" could match "Users". Our resources are "Users", "Tasks", "Products". Use: `resource.name.toLowerCase() === "users"` or `=== "tasks"` exactly. |
| **E** | **Lexicographic ordering strictly** | Add: "Compare full field path string, ASCII byte order, case-sensitive." Reduces model interpretation. |
| **F** | **Resource/view output order** | Add: "Resources in same order as ApiIR.resources. Views: list → detail → create → edit." Our normalizer may already handle this; prompt should state it explicitly. |

### ✅ APPLY — Medium Priority (Schema robustness)

| # | Recommendation | Why it applies |
|---|----------------|----------------|
| **A** | **Formal schema flattening algorithm** | Golden spec has `discontinuedAt: type: ["string","null"]` (nullable primitive), `price.amount`, `inventory.warehouseId`. We should define: primitives = string|number|integer|boolean; nullable (type array with primitive+null) = primitive; depth 2 only; oneOf/anyOf/allOf = do not traverse. |
| **5** | **Primitive definition** | `type: ["string","null"]` — is it primitive? Yes. Add explicit: "Nullable primitive (type array containing primitive + 'null') → treat as primitive." |
| **6** | **Array handling** | We say "Arrays of primitives: include the array path." Add: "Arrays of objects: EXCLUDE. Arrays with nullable items: include if items are primitive or enum." |

### ⚠️ APPLY — Lower Priority (Defense in depth)

| # | Recommendation | Notes |
|---|----------------|-------|
| **G** | **Remove prose examples** | Keep 1 minimal canonical example. Trim EXAMPLE 2, 2b, 3, 4 to reduce token count and interpretation surface. We can consolidate into one richer example. |
| **9** | **Conflict resolution** | Add: "If entity rule applies, use it. If identifierParam equals a field path, exclude that field from list/detail. Required vs optional: required first, then optional." |
| **8** | **Field exclusion generic** | Already partially addressed by C. Extend readOnly to: "field path equals identifierParam (e.g. sku) when identifierParam exists." |

### ❌ OMIT or DEFER

| # | Recommendation | Why omit |
|---|----------------|-------|
| **Model settings (temp, top_p, etc.)** | temperature=0, seed=42 already set in `llm-plan.ts`. top_p=1, frequency_penalty=0, presence_penalty=0 — OpenAI may not expose all; current settings are sufficient. |
| **Regression harness additions** | Valuable but separate from prompt work. Add as follow-up: fixtures for random property order, nullable primitives, depth=3, oneOf, etc. |
| **Full structural rewrite** | Overkill for now. Incremental hardening is sufficient. |
| **additionalProperties / oneOf / anyOf** | Our current specs don't use these. Can add to algorithm as "ignore" for future-proofing but low urgency. |

---

## 2. Prioritized Implementation Plan

### Phase 1: Critical fixes (do first)

1. **Update operation precedence**
   - Add to FIELD INCLUSION RULES: "For edit view: use the update operation's requestSchema. If multiple update operations exist (e.g. PATCH and PUT), use PATCH. If only PUT exists, use PUT. Never merge schemas."

2. **Identifier exclusion (identifierParam)**
   - Extend EXCLUDE list: "id, createdAt, updatedAt, and any path ending with .id, .createdAt, .updatedAt."
   - Add: "If the resource has an update or detail operation with identifierParam (e.g. sku, userId, taskId), and that param name exists as a top-level property in responseSchema, exclude it from list and detail (treat as metadata)."
   - Extend readOnly: "field path exactly equals identifierParam (e.g. sku) when identifierParam exists for the resource."

3. **Entity matching**
   - Replace "when resource name matches (case-insensitive)" with: "When resource.name lowercased EXACTLY equals 'users' or 'tasks'. No partial or substring matching."

### Phase 2: Schema algorithm (formalize)

4. **Primitive + nullable definition**
   - Add section: "PRIMITIVE TYPES: string, number, integer, boolean. Nullable primitive: type is array containing one primitive and 'null' (e.g. type: ['string','null']) → treat as primitive."

5. **Schema flattening algorithm (abbreviated)**
   - Add: "TRAVERSAL: For schema.properties, sort keys lexicographically (ASCII, case-sensitive). For each property: if primitive or enum → include. If object: recurse to depth 2 only; include child paths as K.childKey. If array: include only if items.type is primitive or enum. Ignore oneOf/anyOf/allOf (do not traverse)."

6. **Lexicographic ordering**
   - Add to ORDERING RULES: "Lexicographic = full field path string, ASCII byte comparison, case-sensitive."

### Phase 3: Output order + cleanup

7. **Resource/view order**
   - Add: "Output resources in the same order as ApiIR.resources. Output views in order: list, detail, create, edit."

8. **Example consolidation**
   - Keep EXAMPLE 1 (minimal). Merge EXAMPLE 2 + 2b + 3 into one "Users with profile" example. Keep EXAMPLE 4 (Tasks) brief. Remove redundant prose.

9. **Conflict resolution**
   - Add short: "PRECEDENCE: Entity-specific ordering over generic. Identifier exclusion over inclusion. Required before optional."

---

## 3. Verification

After each phase:
- Run `npm run eval:llm -- --runs 10` to ensure no regression.
- Run `npm run eval:ai -- --runs 5` for full pipeline.
- Optionally add a fixture with: random property order, nullable primitive, depth-3 object, to stress-test.

---

## 4. Summary

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| 1 | Update precedence, identifierParam, entity matching | Low | High — fixes real ambiguity |
| 2 | Primitive def, traversal algorithm, lexicographic | Medium | Medium — future-proofs schema handling |
| 3 | Output order, example trim, conflict resolution | Low | Low — polish |

**Recommendation:** Implement Phase 1 first. It addresses the concrete issues (PATCH vs PUT, sku exclusion, entity matching) that could cause drift. Phase 2 and 3 can follow as hardening.
