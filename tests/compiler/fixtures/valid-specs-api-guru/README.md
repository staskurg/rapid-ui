# Corpus-Valid-v1 Fixtures

OpenAPI specs that pass RUS-v1 validation, extracted from the APIs.guru corpus (20 batches, ~1970 specs).

**Source:** `npm run corpus:extract-valid` + `npm run corpus:copy-valid-to-fixtures`

**Purpose:**
- **Regression tests** — All fixtures must pass `check:openapi` (see `tests/compiler/check-openapi.test.ts`)
- **LLM determinism testing** — Future: validate LLM output stability across runs on real APIs

**Count:** 99 specs (as of 2026-03-04)
