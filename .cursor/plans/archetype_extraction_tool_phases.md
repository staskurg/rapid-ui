# Archetype Extraction Tool — Phased Implementation

This document splits the [archetype_extraction_tool_df7379f2.plan.md](archetype_extraction_tool_df7379f2.plan.md) into **6 phases** that can be implemented by an agent one at a time. Each phase has a clear scope, checkpoint, and verification steps.

**Reference:** Full plan at `.cursor/plans/archetype_extraction_tool_df7379f2.plan.md`

**Design principle:** No imports from `scripts/corpus-data/analyze-apiir.ts`. The archetype tool is standalone.

---

## Phase 1: Types, Constants, and Schema Helpers

**Scope:** Create `scripts/corpus-data/archetype-extractor.ts` with types, constants, and `getObjectSchema` only. No metrics extraction yet.

**Deliverables:**
- `scripts/corpus-data/archetype-extractor.ts` (skeleton)
  - `ARCHETYPES` — frozen string constants for all 22 archetype IDs
  - `ARCHETYPE_ORDER` — explicit array (not `Object.values`)
  - `OperationPattern` type: `"create_only" | "list_only" | "detail_only" | "list_create" | "list_detail" | "list_detail_create" | "crud" | "other"`
  - `ResourceArchetypeMetrics` interface (all fields from plan)
  - `SpecArchetypeMetrics` interface
  - `getObjectSchema(schema: JsonSchema): JsonSchema | null` — extract object from `type: "object"` or from `array.items` when `items.type === "object"`

**Checkpoint:**
- [ ] File compiles with `npx tsc --noEmit`
- [ ] `getObjectSchema` returns object schema for `{ type: "object" }` and `{ type: "array", items: { type: "object" } }`
- [ ] `getObjectSchema` returns `null` for primitives, `{ type: "array", items: { type: "string" } }`, etc.

**Verification:**
```bash
npx tsc --noEmit
# Optional: add a minimal test that imports getObjectSchema and asserts behavior
```

---

## Phase 2: Metrics Extraction

**Scope:** Implement `extractResourceMetrics(resource)` and `deriveOperationPattern(operations)` in `archetype-extractor.ts`.

**Type requirement:** Import `ResourceIR` and `OperationKind` from `@/lib/compiler/apiir` (or `lib/compiler/apiir/types.ts`). Do not redefine resource structure locally. Use `extractResourceMetrics(resource: ResourceIR)`.

**Deliverables:**
- `extractResourceMetrics(resource)` — returns `ResourceArchetypeMetrics`:
  - fieldCount, requiredCount, optionalCount
  - enumCount, arrayCount, arrayOfObjectsCount, arrayOfPrimitivesCount
  - mapCount, nullableCount, nestedObjectCount
  - maxDepth (per plan: object +1, array(object) +1, array(primitive) +0, map(object) +1, map(primitive) +0)
  - maxEnumValues
  - operations, operationCount, operationPattern
  - listResponseShape: `"array_root" | "object_wrapped" | "unknown"` (per plan rules)
  - primitiveOnly (informational only)
- `deriveOperationPattern(operations)` — boolean checks only (see plan)
- Depth algorithm documented in comments

**Checkpoint:**
- [ ] Unit tests in `tests/compiler/archetype-extractor.test.ts`:
  - `extractResourceMetrics` on a minimal create-only resource
  - `deriveOperationPattern` for each pattern (create_only, list_only, crud, etc.)
  - Depth calculation: `User { address { city } }` → depth = 2
  - Response shape: array_root, object_wrapped, unknown
- [ ] `npm test -- archetype-extractor` passes

**Verification:**
```bash
npm test -- archetype-extractor
```

---

## Phase 3: Classification Logic

**Scope:** Implement `classifyResourceArchetypes` and `classifySpecArchetypes` with all 22 archetype rules.

**Deliverables:**
- `classifyResourceArchetypes(resourceMetrics, specMetrics): string[]` — all resource-level archetypes (1–10, 12, 13, 14, 16–18, 20–22)
- `classifySpecArchetypes(specMetrics, resourceMetrics[]): string[]` — spec-level only (11 multi_resource, 15 mixed_operations, 19 large_api)
- `computeSpecComplexityScore(specMetrics): number` — formula from plan
- `aggregateSpecMetrics(resourceMetrics[]): SpecArchetypeMetrics` — Pass 1 aggregation

**Checkpoint:**
- [ ] Unit tests for classification:
  - simple_create: fields≤4, depth=0, create_only
  - mixed_operations: spec has ≥1 create_only AND ≥1 list_only AND ≥1 detail_only
  - optional_heavy: required≤2, optional≥5
  - All 22 archetypes covered (can use parameterized tests)
- [ ] `npm test -- archetype-extractor` passes

**Verification:**
```bash
npm test -- archetype-extractor
```

---

## Phase 4: Main Script — Load, Pass 1, Pass 2, archetypes.json

**Scope:** Create `scripts/extract-archetypes.ts` that loads fixtures, runs two-pass pipeline, and writes `archetypes.json`.

**Deliverables:**
- `scripts/extract-archetypes.ts`:
  - Load ApiIR from `tests/compiler/fixtures/apiir/valid-specs-{github|api-guru}/*.json`
  - **Filesystem order:** `specPaths = readdirSync(dir).filter(...).sort()` — Node `readdir` is not order-stable across OSes; sort before processing for deterministic output
  - Derive `specId` from path: `{corpus}/{filenameWithoutExtension}` (e.g. `github/Cloudmersive__Cloudmersive.APIClient.Java.Native__api__openapi`). **specId normalization:** Do not modify filename characters; do not lowercase or slugify; use filename exactly as fixture name.
  - **Startup log:** After loading, print `Loaded N specs (github: X, api-guru: Y)` — helps debugging
  - Safety check: throw if specCount=0 or resourceCount=0
  - Pass 1: extract resource metrics, aggregate spec metrics
  - Pass 2: classify resources and specs
  - Build archetypes.json with meta, archetypes index, specs (sorted by specId, resources by resource.key)
  - **Archetype index sort:** `Object.fromEntries(Object.entries(archetypeIndex).sort(([a], [b]) => a.localeCompare(b)))` — JSON object order is insertion order; explicit sort ensures snapshot stability
  - **Missing resources:** Use `apiIr.resources ?? []` during Pass 1 — some fixtures may have zero resources
  - **JSON write:** `writeFileSync(path, JSON.stringify(data, null, 2) + "\n")` — trailing newline for snapshot stability
  - CLI: `--limit N`, `--repo github|api-guru`, `--write-json` (default true)
- Add `"extract:archetypes": "tsx scripts/extract-archetypes.ts"` to package.json
- `scripts/corpus-data/reports/` directory created if needed

**Checkpoint:**
- [ ] `npm run extract:archetypes` runs without error (add script to package.json)
- [ ] `scripts/corpus-data/archetypes.json` exists with correct structure:
  - `meta.toolVersion`, `meta.specCount`, `meta.resourceCount`
  - `archetypes` object with alphabetically sorted keys
  - `specs[]` sorted by specId
  - Each spec has `resources[]` sorted by resource.key

**Verification:**
```bash
npm run extract:archetypes
# Inspect scripts/corpus-data/archetypes.json
```

---

## Phase 5: Golden Candidates Selection and Report

**Scope:** Implement selection heuristics and write `golden-candidates.md`.

**Deliverables:**
- **Candidate structure** (define explicitly; do not invent ad-hoc; use `Readonly` to prevent mutation during sort/dedupe):
  ```ts
  type Candidate = Readonly<{
    specId: string;
    resourceKey: string;
    archetype: string;
    score: number;
    // key metrics for report (e.g. fieldCount, arrayOfObjectsCount)
  }>;
  ```
  Selection operates on `Candidate[]`.
- Selection algorithm (resource-first, dedupe by spec, tie-breaker: score → specId → resourceKey)
- `selectedSpecs: Set<string>` for cross-archetype deduplication
- Zero-candidates warning: `⚠ Archetype 'X' has no matching specs.`
- Write `scripts/corpus-data/reports/golden-candidates.md` with 22 sections, score and key metrics per candidate
- CLI: `--write-report` (default true)

**Checkpoint:**
- [ ] `golden-candidates.md` has 22 sections (one per archetype)
- [ ] Each candidate line includes score and key metrics (e.g. `score=22, arrayOfObjects=1, fields=5`)
- [ ] Zero-candidates warning printed to stderr when applicable
- [ ] ~22–30 unique specs total across all archetypes

**Verification:**
```bash
npm run extract:archetypes
# Inspect scripts/corpus-data/reports/golden-candidates.md
```

---

## Phase 6: CLI Polish and Documentation

**Scope:** Add remaining CLI flags, npm script, and docs.

**Deliverables:**
- CLI flags: `--verbose`, `--show-archetype NAME` (debug mode)
- `docs/golden-archetypes.md` — 22 archetypes with rules, rationale, example characteristics
- Snapshot or smoke test: assert archetypes.json structure and golden-candidates has 22 sections
- **toolVersion assertion:** `expect(meta.toolVersion).toBe("1.0")` — prevents stale dataset snapshots when rules change

**Checkpoint:**
- [ ] `npm run extract:archetypes -- --limit 5` processes only 5 specs
- [ ] `npm run extract:archetypes -- --show-archetype simple_create` prints matching specs/resources
- [ ] `docs/golden-archetypes.md` exists with all 22 archetypes documented
- [ ] Snapshot/smoke test passes

**Verification:**
```bash
npm run extract:archetypes -- --limit 5 --verbose
npm run extract:archetypes -- --show-archetype simple_create
npm test -- extract-archetypes  # or archetype
```

---

## Summary Table

| Phase | Focus                          | Key files                         | Checkpoint                          |
| ----- | ------------------------------ | --------------------------------- | ----------------------------------- |
| 1     | Types, constants, getObjectSchema | archetype-extractor.ts            | Compiles, getObjectSchema works      |
| 2     | extractResourceMetrics         | archetype-extractor.ts, test      | Unit tests pass                      |
| 3     | Classification                  | archetype-extractor.ts, test      | All 22 rules tested                  |
| 4     | Main script, archetypes.json    | extract-archetypes.ts, package.json | archetypes.json generated            |
| 5     | Golden candidates               | extract-archetypes.ts              | golden-candidates.md generated       |
| 6     | CLI, docs, smoke test          | extract-archetypes.ts, docs       | Full flow works, docs complete       |

---

## Dependencies Between Phases

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
   │           │           │           │           │
   └───────────┴───────────┴───────────┴───────────┴── No parallelization; each phase builds on the previous
```

---

## Agent Instructions

When implementing a phase:

1. **Read** the full plan (`.cursor/plans/archetype_extraction_tool_df7379f2.plan.md`) for detailed rules.
2. **Implement** only the deliverables for that phase.
3. **Run** the checkpoint verification before considering the phase complete.
4. **Do not** modify `scripts/corpus-data/analyze-apiir.ts`.
5. **Use** `resource.key` from ApiIR as-is for resourceKey.
6. **Derive** specId from fixture path: `{corpus}/{filenameWithoutExtension}` where corpus is `github` or `api-guru` from the parent directory name. Do not modify filename characters (no lowercase, slugify, or other transforms); use filename exactly as-is.
