# GitHub Corpus Workflow

Crawl OpenAPI specs from GitHub, validate them, and run the corpus pipeline.

## Prerequisites

- **GITHUB_TOKEN** in `.env.local` (create at https://github.com/settings/tokens)

## End-to-End Workflow

### 1. Crawl (requires GITHUB_TOKEN)

```bash
# Full run (~900–1100 specs, ~2–3 hours)
npm run corpus:github-crawl

# Quick test: 2 specs per group
npm run corpus:github-crawl -- --limit 2
```

Output: `scripts/corpus-data/corpus-github/` (group-generic, group-frameworks/*, group-vendors, etc.)

### 2. Run validation per group

```bash
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-generic --output-name github-generic
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-frameworks --output-name github-frameworks --recurse
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-vendors --output-name github-vendors
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-platforms --output-name github-platforms
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-cloud --output-name github-cloud
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-api-docs --output-name github-api-docs
```

Output: `scripts/corpus-data/reports/raw-github-{group}-{timestamp}.json`

### 3. Report (optional, per raw file)

```bash
# List reports dir to get exact filenames
ls scripts/corpus-data/reports/

# Generate markdown report for each
npm run corpus:report -- scripts/corpus-data/reports/raw-github-generic-{timestamp}.json
# ... repeat for other groups
```

### 4. Extract valid specs

Reads raw reports and extracts passing specs. Use `--github-only` to exclude APIs.guru batches (only `raw-github-*.json`):

```bash
# GitHub-only (recommended when testing the GitHub pipeline)
npm run corpus:extract-valid -- --github-only --copy-to-fixtures

# Or include all sources (APIs.guru + GitHub)
npm run corpus:extract-valid -- --copy-to-fixtures
```

Output: `rapidui-corpus-valid-v1.json`, `rapidui-corpus-valid-v1.txt`, and copies to `tests/compiler/fixtures/corpus-valid-v1/`

### 5. Generate ApiIR + pattern mining

```bash
npm run fixtures:generate-apiir
npm run corpus:pattern-mining -- --output scripts/corpus-data/reports/pattern-mining-$(date +%Y-%m-%d).md
```

## Quick pipeline test (after `--limit 2` crawl)

```bash
# Step 2: Validate all groups
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-generic --output-name github-generic
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-frameworks --output-name github-frameworks --recurse
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-vendors --output-name github-vendors
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-platforms --output-name github-platforms
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-cloud --output-name github-cloud
npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-api-docs --output-name github-api-docs

# Step 4: Extract valid (--github-only excludes old APIs.guru batches)
npm run corpus:extract-valid -- --github-only --copy-to-fixtures

# Step 5: ApiIR + pattern mining
npm run fixtures:generate-apiir
npm run corpus:pattern-mining -- --output scripts/corpus-data/reports/pattern-mining-test.md
```

If all steps complete without errors, the pipeline is working.
