# AI Evaluation Harness

Comprehensive evaluation harness for testing AI-generated UI specifications. Measures structural validity, logical integrity, stability/determinism, and edge tolerance.

## Usage

```bash
# Run evaluation with default settings (5 runs per fixture)
npm run eval:ai

# Run with custom number of runs
npm run eval:ai -- --runs 10

# Run specific fixture only
npm run eval:ai -- --fixture simple-user

# Custom output directory
npm run eval:ai -- --output-dir ./custom-reports

# Replay saved failures (regression testing)
npm run eval:ai -- --replay-failures

# Show help
npm run eval:ai -- --help
```

## What It Tests

1. **Structural Validity**: Ensures generated specs pass Zod schema validation (target: ≥90% valid rate)
2. **Logical Integrity**: Verifies field references exist, enum fields have options, table/form configs are usable
3. **Stability/Determinism**: Compares structural consistency across multiple runs (field names, types, table/form/filter structure)
4. **Edge Tolerance**: Tests handling of weird/incomplete payloads without breaking

## Output

Reports are generated in `eval/reports/`:
- `report-{timestamp}.md` - Markdown format with detailed metrics
- `report-{timestamp}.txt` - Plain text format

Failed responses are saved to `eval/fixtures/failures/` for regression testing. Use `--replay-failures` to re-evaluate fixtures that previously failed.

## Fixtures

Test payloads are located in `eval/fixtures/`:
- `simple-user.json` - Basic user entity
- `enum-heavy.json` - Multiple enum fields
- `numeric.json` - Numeric-heavy payload
- `mixed.json` - Complex mixed types
- `nested.json` - Nested objects (user.name, order.total, etc.) — tests dot notation and camelCase resolution
- `weird.json` - Edge cases (nulls, empty arrays, etc.)

## Integration

This harness complements the fixture-based contract tests:
- **Contract tests**: Fast, stable validation (run on every commit)
- **AI eval**: Comprehensive determinism and stability testing (run on prompt/schema changes)

Run evaluation after:
- Prompt changes (`lib/ai/prompt.ts`)
- Schema changes (`lib/spec/schema.ts`)
- Inference updates (`lib/inference/`)
