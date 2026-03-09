# Corpus-Valid-v1 Fixtures (GitHub)

OpenAPI specs that pass RUS-v1 validation, extracted from the GitHub corpus.

**Source:** `npm run corpus:copy-valid-to-fixtures -- --repo github`

**Purpose:**
- **Regression tests** — All fixtures must pass `check:openapi`
- **LLM determinism testing** — Validate LLM output stability across runs on real APIs

**Workflow:** `corpus:run --repo github` → `corpus:report --repo github` → `corpus:copy-valid-to-fixtures -- --repo github` → `fixtures:generate-apiir`
