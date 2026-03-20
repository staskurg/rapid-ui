# LLM Determinism Evaluation

Evaluation harness for the **MVP v3 OpenAPI compiler** determinism. Proves the LLM step (ApiIR → UiPlanIR) and full pipeline (OpenAPI → UISpec) produce sufficiently stable output.

## Prerequisites

**OPENAI_API_KEY is required.** Add it to `.env.local` to run evals. The harness fails fast if the key is missing. Postgres is not required for evals—they run the compiler pipeline only.

## Scripts

```bash
# Full pipeline: OpenAPI → UISpec (default: fixtures/demo/)
npm run eval:ai
npm run eval:ai -- --dir demo

# LLM-only: ApiIR → UiPlanIR (default: fixtures/apiir/demo/)
npm run eval:llm
npm run eval:llm -- --dir demo

# Run on a different folder (e.g. golden-specs, valid-specs-api-guru)
npm run eval:ai -- --dir valid-specs-api-guru
npm run eval:llm -- --dir valid-specs-api-guru

# Run both evals in parallel (faster)
npm run eval:all
npm run eval:all -- --dir demo

# Generate ApiIR fixtures from OpenAPI (run after parse/validate/build changes)
npm run fixtures:generate-apiir
```

## What It Tests

1. **Full pipeline (`eval:ai`)**: OpenAPI YAML → parse → validate → canonicalize → ApiIR → LLM → UiPlanIR → lower → UISpec. Runs N times per fixture, compares UISpec fingerprints. Pass: ≥90% valid runs AND ≥90% per-resource structural similarity.

2. **LLM-only (`eval:llm`)**: ApiIR JSON → llmPlan → UiPlanIR. True LLM isolation; no pipeline code runs. Compares UiPlanIR fingerprints. Pass: ≥90% valid runs AND ≥90% similarity.

## Fixtures

- **OpenAPI** (`tests/compiler/fixtures/{dir}/*.yaml`): Source for full pipeline. Use `--dir NAME` to pick a subfolder (default: `demo`). Invalid specs live in `invalid/` — use `--dir invalid` to test failure cases.
- **ApiIR** (`tests/compiler/fixtures/apiir/{dir}/*.json`): Pre-generated from OpenAPI. Source for LLM-only. Use `--dir NAME` to pick a subfolder (default: `demo`). Regenerate via `npm run fixtures:generate-apiir` when parse/validate/build changes.

**Folders:** `demo` (valid golden + demo v1/v2/v3), `invalid` (intentionally failing specs), `valid-specs-api-guru`, `valid-specs-github`. Add custom folders (e.g. `golden-specs`) as needed.

**Adding a new spec:** Add YAML to `tests/compiler/fixtures/{dir}/`, then run `npm run fixtures:generate-apiir` to create ApiIR fixtures. Use `--runs 10` or higher for thorough determinism checks.

## CLI Options

Both `eval:ai` and `eval:llm` support:

```
--dir NAME     Fixture subfolder (default: demo). eval:ai → fixtures/{dir}/, eval:llm → fixtures/apiir/{dir}/
--runs N       Number of runs per fixture (default: 5)
--quick, -q    Quick mode (2 runs for eval:ai, 5 for eval:llm)
--parallel, -p Run all runs in parallel (faster; may hit rate limits)
--fixture NAME Run specific fixture only
--json         Output JSON for CI: { passed, validity, similarity, errors }
```

Both evals write reports to `eval/reports/` (created automatically if missing):

- `report-full-{timestamp}.json` — full pipeline (machine-readable, includes full diffs)
- `report-full-{timestamp}.txt` — full pipeline (human summary)
- `report-llm-only-{timestamp}.json` — LLM-only (machine-readable, includes full diffs)
- `report-llm-only-{timestamp}.txt` — LLM-only (human summary)

The JSON reports use the `diff` package (jsdiff) for unified diffs and include `computeMultiSpecDiff` (full) or `similarityDifferences` (llm-only) for structured diffs. No truncation — full diffs for prompt debugging.

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

- **Before shipping**: Evals must pass before releasing compiler changes.
- **After changes to**: UiPlanIR prompts (`lib/compiler/uiplan/prompt.*`), schema (`uiplan.schema.ts`), or LLM model/temperature.
- **After parse/validate/build changes**: Regenerate ApiIR fixtures (`npm run fixtures:generate-apiir`), then run evals.

## Failure Handling

- **Retry**: 429/503 from LLM → retry once with 2s backoff (eval layer only).
- **Timeout**: Per-run 60s; timeout counts as invalid.
- **No valid runs**: Exit 1 (eval failed).
- **Replay**: Failed runs saved to `eval/fixtures/failures/` with `{ fixtureName, runNumber, openapiPath }`. Use `--replay-failures` to re-run those fixtures.
