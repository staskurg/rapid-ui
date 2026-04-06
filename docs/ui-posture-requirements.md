# UI posture & corpus reporting — requirements

This document defines **product and pipeline requirements** for closing the gap between **valid OpenAPI specs** (subset + ApiIR) and **scalable UI coverage** (UiPlan, UISpec, renderer). It is input for an **implementation plan**, not a design of the final posture schema.

---

## 1. Goals

1. **Single source of structured “what UI does this need?”** per spec or per resource, derived from committed **ApiIR** (Pipeline B), so humans do not manually review hundreds of specs one by one to infer UI families.

2. **Aggregate reporting** over that source so **pattern mining** (or a dedicated rollup) answers: _How many specs need which UI families?_ _What distinct use cases must the renderer support?_

3. **Align golden archetypes and golden specs** with **UI-oriented patterns**, not only with low-level operation-kind statistics—while **reusing** existing gates (`verify:apiir-fixtures`, `check-openapi`) and existing analytics where possible.

4. **Inform** UiPlan / UISpec schema evolution and **renderer shells** from a stable, reviewable catalog—not from ad hoc doc-by-doc notes.

---

## 2. Definitions

| Term                              | Meaning                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RapidUI subset**                | Rules that define which OpenAPI documents are accepted; invalid specs are out of scope for posture.                                                                                                  |
| **Valid spec (fixture context)**  | A spec that passes subset validation and produces **ApiIR** (e.g. committed under `tests/compiler/fixtures/`).                                                                                       |
| **UI posture**                    | Structured classification of **what categories of UI surfaces** a spec or resource requires for a faithful experience (e.g. CRUD table + detail vs scoped collection vs multi-action / RPC console). |
| **UI posture catalog**            | Machine-readable collection of posture rows (recommended: **JSONL**, one row per stable grain—see §5).                                                                                               |
| **UI posture report**             | **Aggregate** markdown/JSON over the catalog: frequencies, clusters, distinct “use case” keys—**for humans and roadmap**, not a replacement for the catalog.                                         |
| **`corpus:ui-readiness` (today)** | Existing script: list-like ops, primary list-like op, `required_query_on_list` per `(specId, resourceKey)`. This is a **subset** of full posture (list/filter readiness only).                       |

---

## 3. Target pipeline (logical order)

1. **Subset** defines acceptance.
2. **Corpus run + corpus report** (Pipeline A) identify **valid** specs in large batches and acceptance/language context.
3. **Fixture discipline**: `verify:apiir-fixtures`, `check-openapi` ensure **ApiIR** matches sources for the fixture set used in product work.
4. **UI posture emission**: walk valid **ApiIR** fixtures and emit the **posture catalog** (new or extended—see §6).
5. **Posture aggregation**: script(s) read the catalog and produce **UI use-case frequency / pattern** reports (extend **pattern mining** or add **`corpus:ui-posture-report`**).
6. **Archetypes & golden specs**: name discrete patterns that matter for tests and product; pin specs per pattern (`extract:archetypes`, golden candidates).
7. **Compiler & renderer**: UiPlan, UISpec, and renderer implementations **cover** the archetypes; **eval:llm** / **eval:ai** validate LLM and lower stages against representatives.

Steps 4–5 are the **documented gap** relative to current tooling (§4).

---

## 4. Current state vs gap

| Capability                   | Today                                                | Requirement                                                                                      |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Validity / ApiIR integrity   | `verify:apiir-fixtures`, `check-openapi`             | **Keep** as gates before posture runs.                                                           |
| Corpus-wide structural stats | `corpus:report`, `corpus:pattern-mining` on ApiIR    | **Keep** for API-shape analytics; **add or chain** posture rollup **inputs** (catalog).          |
| List/filter readiness        | `corpus:ui-readiness` (JSONL)                        | **Keep**; either **embed** those fields in posture rows or **treat** as one column of posture.   |
| **Full UI posture row**      | Not defined as a single artifact                     | **Define schema** + emitter (§5–§6).                                                             |
| **Mine “UI use cases”**      | Pattern mining does **not** cluster on posture enums | **Require** aggregator that consumes posture catalog and outputs distinct pattern keys + counts. |
| Golden archetypes            | Driven largely by **API-structure** metrics          | **Evolve** toward posture / use-case keys where product requires it.                             |

---

## 5. Posture catalog — requirements (schema TBD in implementation plan)

The implementation plan should fix the exact JSON shape. The **requirements** below are constraints on that design.

### 5.1 Grain

- **Minimum**: one row per **`(specId, resourceKey)`** consistent with `corpus:ui-readiness` (`specId` relative to `tests/compiler/fixtures/apiir/`, collision-free).
- **Optional**: per-spec rollups (aggregated across resources) as a derived view—not a substitute for per-resource rows.

### 5.2 Provenance

- **Input** must be **ApiIR JSON** (same fixtures as verify/mining), not raw OpenAPI, unless a future phase explicitly chooses otherwise.
- Rows should include **apiIrVersion** / identifiers needed to **re-run** and diff when the subset or classifier changes.

### 5.3 Content (illustrative dimensions — finalize in plan)

The classifier should be **deterministic** (rules over ApiIR) for v1; optional LLM summarization is **out of scope** for the core requirement unless explicitly added later.

Illustrative **boolean or numeric** signals (non-exhaustive):

- Presence and counts of **`list`**, **`listScoped`**, **`detail`**, **`create`**, **`update`**, **`delete`**.
- **`multipleCreateLikeOperations`** (or count of `create` / POST-shaped ops per resource)—flags **RPC bundle** ambiguity for single “create” form UIs.
- **`hasListLike`**, **`hasDetail`**, **`listScopedOnly`**, **`required_query_on_list`** (may mirror or import `corpus:ui-readiness`).
- **Suggested `uiMode` enum** (v1): small fixed set, e.g. `crud_table`, `scoped_collection`, `action_console`, `read_heavy`, `mixed`, `unknown`—exact values and derivation rules belong in the implementation plan.

### 5.4 Output location & npm task

- Implementation plan should standardize path (e.g. `scripts/corpus-data/reports/ui-posture-{timestamp}.jsonl`) and **`npm run corpus:ui-posture`** (or agreed name).
- **Idempotent** classification: same ApiIR + same classifier version → same row content (for CI/regression).

---

## 6. Posture aggregation (“pattern mining” alignment)

### 6.1 Requirement

A **second step** must read **only** the posture catalog (or catalog + minimal ApiIR join if needed) and produce:

- Counts and percentages per **`uiMode`** (or equivalent primary key).
- Counts for **combinations** of flags that imply renderer work (e.g. `multi_create + listScoped`).
- A short **human-readable markdown** summary suitable for roadmap (“top 10 UI pattern clusters”).

### 6.2 Relation to existing `corpus:pattern-mining`

- **Option A**: Extend pattern mining to **ingest** posture JSONL and add **UI-oriented** sections.
- **Option B**: New script **`corpus:ui-posture-summary`**; pattern mining stays **ApiIR-structural** only.

The implementation plan chooses **A or B**; the **requirement** is that operators can answer **“how many specs need shell X?”** without scanning raw specs.

---

## 7. Archetypes and goldens

- **Requirement**: Archetype / golden-candidate selection should be **traceable** to posture **distinct keys** (e.g. at least one golden per high-frequency `uiMode` + critical edge combos).
- **Non-requirement (for this doc)**: Exact renumbering of `golden-archetypes.md`; that follows once posture keys are stable.

---

## 8. Non-goals (for initial posture v1)

- Replacing **subset-validator** or **ApiIR build** semantics.
- **LLM-generated** posture prose as the **source of truth** (optional future add-on only).
- **Live E2E** or **eval:llm** thresholds—those **consume** archetypes after posture drives design.

---

## 9. Acceptance criteria (for the future implementation)

1. Running the posture emitter over **`verify:apiir-fixtures`-green** tree completes **without manual steps** and produces **JSONL** (or agreed format) with stable grain and documented fields.

2. Running the aggregator produces a **summary** that lists **distinct UI pattern buckets** and counts **aligned with** manual spot-checks on a small set (including at least one **multi-create / RPC-style** resource such as IntelligenceService-style fixtures).

3. Documentation links **this pipeline** from **ARCHITECTURE.md** or corpus operator docs (Phase 9–style doc updates may reference this file).

---

## 10. References (existing)

- Fixture verification: `npm run verify:apiir-fixtures`
- List readiness: `npm run corpus:ui-readiness`, `scripts/corpus-ui-readiness.ts`
- Structural mining: `npm run corpus:pattern-mining`, `scripts/corpus-data/analyze-apiir.ts`
- Archetypes: `scripts/extract-archetypes.ts`, `docs/golden-archetypes.md`, `docs/pre-phase-6-archetypes.md`
- Handoff / phase context: `docs/apiir-corpus-vnext-handoff.md`

---

## 11. Implementation plan — next steps (placeholder)

The owner of the implementation plan should:

1. Lock **v1 posture field list** and **`uiMode`** enum derivation rules.
2. Choose **Option A vs B** for aggregation (§6.2).
3. Add **tests** (golden ApiIR in, expected posture row out) for representative fixtures: CRUD, listScoped, multi-create RPC bundle.
4. Update **operator docs** and **npm scripts** table in `package.json`.

This document stops here; the implementation plan carries dates, owners, and migration from current reports.
