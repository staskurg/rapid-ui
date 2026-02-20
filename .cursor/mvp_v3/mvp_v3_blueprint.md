# RapidUI MVP v3 — OpenAPI Compiler Blueprint

## PURPOSE

Evolve RapidUI into **MVP v3**, an OpenAPI-based UI compiler.

This system:

* Compiles OpenAPI → UISpec → UI
* Treats OpenAPI as the **source of truth**
* Treats AI as a **constrained compiler phase**
* Guarantees: **same OpenAPI → same UISpec → same UI**

This is **not** an AI UI builder.
This is a **deterministic compiler pipeline**.

---

# 1. COMPILER CONSTITUTION (NON-NEGOTIABLE)

This section defines **hard invariants**.
Any behavior violating these rules is a **bug**, not a feature.

### 1.1 Input Contract

* MVP v3 generation path is **OpenAPI upload only**
* MVP v2 modes (Demo / External / Paste JSON) remain **legacy** and unchanged
* Accept OpenAPI **3.0.x and 3.1**
* Compile **only** the RapidUI Schema Subset:

  * Intersection of:

    * OpenAPI 3.0 Schema Object
    * JSON Schema 2020-12 (3.1)
* Unsupported constructs cause **hard compile errors**

### 1.2 Canonicalization & Identity

* OpenAPI is normalized into **Canonical OpenAPI JSON**
* Canonicalization includes:

  * Local `$ref` resolution (same document only)
  * Stable key ordering
  * Stable array ordering
  * Removal of irrelevant/ignored fields
* Hashing:

  * `openapiCanonicalHash = sha256(canonicalOpenApiJson)` (**primary identity**)
  * `apiIrHash = sha256(ApiIR JSON)`
  * `uiSpecHash = sha256(UISpec JSON)`
* Determinism invariants:

  * `openapiCanonicalHash → ApiIR` is deterministic
  * `ApiIR → UISpec` is deterministic

### 1.3 Resource Grouping

1. If **ALL operations** have **exactly one tag**:

   * Group by tag
2. Else group by **path-based resource key**:

   * Strip leading segments in allowlist: `["api", "v1", "v2", "v3"]`
   * Take first remaining segment as resource key
3. If a resource cannot be assigned uniquely:

   * **Compile error**
   * No guessing, no merging

### 1.4 Tags

* Operations with **multiple tags** are invalid for tag-based grouping
* No automatic merging, sorting, or heuristics

### 1.5 CRUD Semantics

* Supported operations only:

  * `GET` → list or detail
  * `POST` → create
  * `PUT | PATCH` → update
  * `DELETE` → delete
* Non-CRUD endpoints are **unsupported** → compile error

### 1.6 Request Bodies

* `POST`, `PUT`, `PATCH` **must** define:

  * `application/json` request body schema
* Missing request body → **compile error**
* Empty forms / action-only endpoints are out of scope

### 1.7 Identifiers

* `GET /resource/{param}` with **exactly one** path parameter:

  * Treated as detail view
* Path param name is irrelevant (`id`, `userId`, `slug`, etc.)
* More than one path parameter → **compile error**

### 1.8 Responses

* Exactly **one canonical success response** allowed:

  * Prefer `200`, else `201`
* Content type must be `application/json`
* Multiple success responses or content types → **compile error**

### 1.9 Schema Semantics

* UISpec field `required` = OpenAPI `required`
* `nullable` affects validation only, not presence
* Fields are **never invented**

### 1.10 Descriptions

* Optional metadata only
* May be used for labels/help text
* Must **not** affect structure, layout, or inclusion

### 1.11 LLM Boundary

* LLM input = **ApiIR only**
* LLM is allowed to:

  * infer labels
  * order fields
  * mark readOnly
* LLM is NOT allowed to:

  * add/remove fields
  * invent views
  * change resource structure
  * infer API semantics

### 1.12 Failure Behavior

* Any failure at any stage:

  * **No regeneration**
  * Previous UISpec remains active
  * User sees error with stage + stable error code

### 1.13 OpenAPI Interpretation Notes (Non-Normative but Binding)

The following rules clarify how RapidUI interprets the OpenAPI Specification.
They do not expand supported functionality but make implicit assumptions explicit.

These rules are **binding for compiler behavior**.

#### Schema Annotations
- `format`, `pattern`, `example`, `description`, and similar keywords are treated as **annotations only**
- No type is ever inferred implicitly from annotations
- UI field types are derived strictly from explicit `type` declarations

#### JSON Schema Semantics
- JSON Schema keywords are interpreted conservatively
- Validation keywords do not imply UI structure
- Composition keywords (`oneOf`, `anyOf`, `allOf`, `not`) are unsupported and cause hard errors

#### Request Bodies
- Request bodies on `GET` and `DELETE` operations are ignored
- Only `POST`, `PUT`, and `PATCH` participate in form generation

#### Parameters
- Only `path` and `query` parameters are supported
- `header`, `cookie`, and `querystring` parameters are ignored or rejected
- Query parameters are treated as list filters only

#### External References
- Only local `$ref` references within the same document are supported
- External `$ref` references cause hard compile errors

#### Streaming and Non-JSON Media Types
- Streaming responses and non-`application/json` content types are unsupported
- Such operations cause hard compile errors

#### OpenAPI Version Notes
- OpenAPI 3.0.x and 3.1 inputs are accepted
- OpenAPI 3.2 features are ignored unless they map cleanly to the supported subset

---

# 2. COMPILER PIPELINE (FIXED)

```
OpenAPI Upload
   ↓
Parse + Subset Validation
   ↓
Canonicalization + Hashing
   ↓
OpenAPI → ApiIR (deterministic)
   ↓
LLM Planning (ApiIR → raw UiPlanIR)
   ↓
Zod validation → UiPlanIR normalization → hash(uiPlanIR)
   ↓
Lowering (UiPlanIR → UISpec)
   ↓
UISpec Validation
   ↓
Renderer (unchanged from v2)
```

LLM **never** sees OpenAPI.
Validation and normalization are part of the LLM phase; Phase 5 receives **canonical** UiPlanIR only.

---

# 3. PHASED IMPLEMENTATION PLAN

Each phase is **irreversible progress**.
Do not start the next phase until acceptance criteria pass.

---

## Phase 1 — OpenAPI Ingestion & Subset Validator

### Goal

Parse OpenAPI and reject unsupported constructs **early**.

### Deliverables

* OpenAPI upload endpoint/UI
* OpenAPI parser (YAML + JSON)
* Subset validator producing structured errors

### Error Behavior

* Any validation error → stop compilation

### Acceptance Criteria

* Same invalid spec → same ordered error list
* oneOf / anyOf / allOf → hard error
* Multiple success responses → hard error

---

## Phase 2 — Canonicalization & Hashing

### Goal

Produce a **canonical OpenAPI JSON** and stable hash.

### Deliverables

* `$ref` resolver (local only)
* Deterministic key + array sorting
* `openapiCanonicalHash`

### Acceptance Criteria

* Same spec with reordered keys → same canonical JSON
* Same canonical JSON → same hash

---

## Phase 3 — OpenAPI → ApiIR (Deterministic)

### Goal

Convert canonical OpenAPI into a **pure semantic IR**.

### ApiIR Schema (Authoritative)

```ts
ApiIR {
  api: {
    title: string
    version: string
  }
  resources: ResourceIR[]
}

ResourceIR {
  name: string                // stable
  key: string                 // derived grouping key
  operations: OperationIR[]   // stable order
}

OperationIR {
  id: string                  // stable deterministic id
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  kind: "list" | "detail" | "create" | "update" | "delete"
  path: string
  identifierParam?: string    // for detail/update/delete
  requestSchema?: JsonSchema
  responseSchema: JsonSchema
}
```

### Acceptance Criteria

* ApiIR JSON is byte-stable
* Ambiguous grouping → compile error
* CRUD kind inferred **without LLM**

---

## Phase 4 — LLM Planning (ApiIR → UiPlanIR)

### Goal

Allow LLM to do **classification only**, not interpretation.

### Artifacts (all under `lib/compiler/uiplan/`)

* `prompt.system.txt` — immutable, versioned; specification of the LLM compiler stage (like a grammar/ruleset)
* `prompt.user.ts` — programmatic template; injects UiPlanIR schema (as text) and ApiIR JSON (canonical string)
* `uiplan.schema.json` — canonical, language-agnostic contract (LLM boundary)
* `uiplan.schema.ts` — Zod schema used at runtime; produces deterministic, structured errors
* `normalize.ts` — deterministic UiPlanIR canonicalizer; same logical plan → byte-identical UiPlanIR → stable hashes

These are **compiler internals**, not app config or UI code. Any change to them is a **compiler behavior change** and should invalidate snapshots.

### Internal sub-steps (order is fixed)

1. Serialize ApiIR (canonical JSON)
2. Call LLM with system prompt + user prompt
3. Validate LLM output with Zod (failure → retry max 2 → fail)
4. Normalize UiPlanIR
5. Hash normalized UiPlanIR

Phase 4 is **not complete** until normalization is done. Phase 5 assumes UiPlanIR is already canonical.

### UiPlanIR Schema

```ts
UiPlanIR {
  resources: {
    name: string
    views: {
      list?: ViewPlan
      detail?: ViewPlan
      create?: ViewPlan
      edit?: ViewPlan
    }
  }[]
}

ViewPlan {
  fields: {
    path: string
    label?: string
    readOnly?: boolean
    order?: number
  }[]
}
```

### Constraints

* Input = ApiIR only
* Fixed model, temperature = 0
* Output must validate against schema
* Invariant: if it doesn’t validate, it doesn’t exist

### Acceptance Criteria

* Same ApiIR → same normalized UiPlanIR
* Invalid output → retry max 2 → fail

---

## Phase 5 — Lowering (UiPlanIR → UISpec)

### Goal

Produce deterministic UISpec consumed by existing renderer.

### Rules

* Input is **normalized UiPlanIR** from Phase 4; no validation or reordering in this phase
* Stable IDs:

  * viewId = hash(resource + viewType)
  * fieldId = hash(resource + fieldPath)
* Stable ordering everywhere

### Acceptance Criteria

* Same UiPlanIR → byte-identical UISpec
* UISpec passes existing validator

---

## Phase 6 — Versioning, Regen, Diff

### Goal

Preserve trust through immutability.

### Rules

* Each upload creates a new version
* Full regeneration only
* Diff is informational only

### Acceptance Criteria

* Re-upload same spec → empty diff
* Failed compile → previous UISpec remains active

---

## Phase 7 — Determinism Harness & Golden Specs

### Goal

Prove compiler correctness.

### Deliverables

* Golden OpenAPI specs (2)
* Snapshot tests for:

  * Canonical OpenAPI
  * ApiIR
  * UISpec

### Acceptance Criteria

* Same input compiled twice → byte-identical outputs
* Any change is intentional and visible in diff

---

# 4. ERROR TAXONOMY (STABLE)

Errors must include:

* `code`
* `stage`
* `message`
* `jsonPointer` (when applicable)

### Example Codes

* `OAS_UNSUPPORTED_SCHEMA_KEYWORD`
* `OAS_MULTIPLE_SUCCESS_RESPONSES`
* `OAS_AMBIGUOUS_RESOURCE_GROUPING`
* `OAS_MISSING_REQUEST_BODY`
* `OAS_MULTIPLE_PATH_PARAMS`
* `IR_INVALID`
* `UIPLAN_INVALID`
* `UISPEC_INVALID`

No warnings. All errors are blocking.

---

# 5. DEFINITION OF DONE (MVP v3)

MVP v3 is complete when:

* OpenAPI upload produces UI end-to-end
* Same OpenAPI → same UISpec → same UI
* All unsupported constructs fail loudly
* Renderer remains unchanged
* Demo with golden specs is boring, predictable, and credible

---

# 6. COMPILER ARTIFACT PLACEMENT & OWNERSHIP

The following rules clarify **where** key compiler artifacts live and **why**. Think in **compiler stages**, not “AI helpers.”

### System prompt + user prompt

* **What:** Specification of the LLM compiler stage
* **Where:** `lib/compiler/uiplan/` — `prompt.system.txt`, `prompt.user.ts`
* **Phase:** Phase 4 — LLM Planning
* **Invariant:** LLM is a **pure classifier** with no access to OpenAPI and no authority over structure

### UiPlanIR schema (JSON + Zod)

* **What:** Formal interface contract between the LLM stage and the deterministic pipeline
* **Where:** `lib/compiler/uiplan/` — `uiplan.schema.json`, `uiplan.schema.ts`
* **Phase:** Phase 4 — validation happens immediately after LLM output
* **Invariant:** Nothing crosses this boundary unvalidated

### UiPlanIR normalizer

* **What:** Deterministic canonicalizer (same role as OpenAPI canonicalization / ApiIR normalization)
* **Where:** `lib/compiler/uiplan/` — `normalize.ts`
* **Phase:** Phase 4 (post-LLM normalization); not Phase 5 — Phase 5 must be a pure function of normalized UiPlanIR
* **Invariant:** Same logical plan → byte-identical UiPlanIR → stable hashes → stable UISpec

### Ownership (mental model)

| Artifact        | Owner    | Mental model    |
| --------------- | -------- | ---------------- |
| System prompt   | Compiler | Grammar / rules  |
| User prompt     | Compiler | Code generator  |
| UiPlanIR schema | Compiler | ABI / interface |
| Normalizer      | Compiler | Canonicalizer   |
| Lowering        | Compiler | Codegen         |

None of these belong to UI, product config, feature flags, or experimentation. They are **compiler internals**.

### Rule of thumb

If a change to something can change hashes, change diffs, or change generated UI for the same OpenAPI → it belongs in **compiler/** and is **versioned behavior**.
