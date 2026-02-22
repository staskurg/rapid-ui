# LLM Determinism Evaluation

Evaluation harness for OpenAPI → UISpec compiler determinism. Proves the LLM step (ApiIR → UiPlanIR) and full pipeline produce sufficiently stable output before shipping UI.

## Prerequisites

**OPENAI_API_KEY is required.** Add it to `.env.local` to run evals. The harness fails fast if the key is missing.

## Scripts

```bash
# Full pipeline: OpenAPI → UISpec (runs compileOpenAPI N times per fixture)
npm run eval:ai

# LLM-only: ApiIR → UiPlanIR (loads pre-computed ApiIR, no pipeline)
npm run eval:llm

# Generate ApiIR fixtures from OpenAPI (run after parse/validate/build changes)
npm run fixtures:generate-apiir
```

## What It Tests

1. **Full pipeline (`eval:ai`)**: OpenAPI YAML → parse → validate → canonicalize → ApiIR → LLM → UiPlanIR → lower → UISpec. Runs N times per fixture, compares UISpec fingerprints. Pass: ≥90% valid runs AND ≥90% per-resource structural similarity.

2. **LLM-only (`eval:llm`)**: ApiIR JSON → llmPlan → UiPlanIR. True LLM isolation; no pipeline code runs. Compares UiPlanIR fingerprints. Pass: ≥90% valid runs AND ≥90% similarity.

## Fixtures

- **OpenAPI** (`tests/compiler/fixtures/*.yaml`): Source for full pipeline. Excludes `golden_openapi_invalid_expected_failure.yaml`.
- **ApiIR** (`tests/compiler/fixtures/apiir/*.json`): Pre-generated from OpenAPI. Source for LLM-only. Regenerate via `npm run fixtures:generate-apiir` when parse/validate/build changes.

## CLI Options

Both `eval:ai` and `eval:llm` support:

```
--runs N       Number of runs per fixture (default: 5)
--quick, -q    Quick mode (2 runs for eval:ai, 5 for eval:llm)
--parallel, -p Run all runs in parallel (faster; may hit rate limits)
--fixture NAME Run specific fixture only
--json         Output JSON for CI: { passed, validity, similarity, errors }
```

Both evals write reports to `eval/reports/` (created automatically if missing):
- `report-full-{timestamp}.txt` — full pipeline
- `report-llm-only-{timestamp}.txt` — LLM-only

`eval:ai` also supports:

```
--output-dir DIR   Report output directory (default: eval/reports)
--replay-failures  Replay saved failures from eval/fixtures/failures/
```

`eval:llm` also supports:

```
--output-dir DIR   Report output directory (default: eval/reports)
```

## When to Run

- **Before Phase 6.5**: Evals must pass before shipping full generated UI.
- **After changes to**: UiPlanIR prompts (`lib/compiler/uiplan/prompt.*`), schema (`uiplan.schema.ts`), or LLM model/temperature.
- **After parse/validate/build changes**: Regenerate ApiIR fixtures (`npm run fixtures:generate-apiir`), then run evals.

## Failure Handling

- **Retry**: 429/503 from LLM → retry once with 2s backoff (eval layer only).
- **Timeout**: Per-run 60s; timeout counts as invalid.
- **No valid runs**: Exit 1 (eval failed).
- **Replay**: Failed runs saved to `eval/fixtures/failures/` with `{ fixtureName, runNumber, openapiPath }`. Use `--replay-failures` to re-run those fixtures.
