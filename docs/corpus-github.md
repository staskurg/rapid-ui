# GitHub Corpus Workflow

Crawl OpenAPI specs from GitHub, validate them, and run the corpus pipeline.

**CRUD-focused:** The crawler targets CRUD-style APIs (post/put/delete signals) and filters out read-only integration APIs. See query design and `--no-crud-filter` below.

## Prerequisites

- **GITHUB_TOKEN** in `.env.local` (create at https://github.com/settings/tokens)

## End-to-End Workflow

### 1. Crawl (requires GITHUB_TOKEN)

```bash
# Full run (~1200–1500 specs, ~3–4 hours; CRUD filter enabled)
npm run corpus:github-crawl

# Quick test: 2 specs per group
npm run corpus:github-crawl -- --limit 2

# Disable CRUD filter (save read-only APIs too; for comparison)
npm run corpus:github-crawl -- --no-crud-filter
```

Output: `scripts/corpus-data/specs/github/` (group-generic, group-frameworks/*, group-crud, group-vendors, etc.)

### 2. Run validation per group

```bash
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-generic --output-name github-generic
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-frameworks --output-name github-frameworks --recurse
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-crud --output-name github-crud
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-vendors --output-name github-vendors
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-platforms --output-name github-platforms
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-cloud --output-name github-cloud
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-api-docs --output-name github-api-docs
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

Output: `rapidui-corpus-valid-v1.json`, `rapidui-corpus-valid-v1.txt`, and copies to `tests/compiler/fixtures/valid-specs-api-guru/`

### 5. Generate ApiIR + pattern mining

```bash
npm run fixtures:generate-apiir
npm run corpus:pattern-mining -- --output scripts/corpus-data/reports/pattern-mining-$(date +%Y-%m-%d).md
```

## Quick pipeline test (after `--limit 2` crawl)

```bash
# Step 2: Validate all groups
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-generic --output-name github-generic
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-frameworks --output-name github-frameworks --recurse
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-crud --output-name github-crud
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-vendors --output-name github-vendors
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-platforms --output-name github-platforms
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-cloud --output-name github-cloud
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-api-docs --output-name github-api-docs

# Step 4: Extract valid (--github-only excludes old APIs.guru batches)
npm run corpus:extract-valid -- --github-only --copy-to-fixtures

# Step 5: ApiIR + pattern mining
npm run fixtures:generate-apiir
npm run corpus:pattern-mining -- --output scripts/corpus-data/reports/pattern-mining-test.md
```

If all steps complete without errors, the pipeline is working.

## Crawler design (CRUD focus)

- **Queries** are defined in `scripts/corpus-github-queries.ts` (source of truth for test and crawler).
- **Path-based granularity:** Generic queries are split by `path:api/`, `path:docs/`, `path:spec/`, `path:specs/`, `path:openapi/` to bypass GitHub's 1000-result limit per query.
- **Version splits:** Base generic queries also split by `"openapi: 3.0"` vs `"openapi: 3.1"` for balanced 3.0.x/3.1.x diversity.
- **CRUD signals:** Queries include `"post:"`, `"put:"`, or `"delete:"` to favor CRUD APIs over read-only integration APIs.
- **SaaS boilerplate** group (`group-crud`) searches for `"users:"`, `"orders:"`, `"projects:"`, etc. with `"post:"` — high signal for internal backends.
- **CRUD filter:** Before saving, specs must have `crudScore >= 2` (post+put+delete) or `crudScore >= 1` with list+detail path pattern. Use `--no-crud-filter` to disable.
- **Per-query caps** for diversity: generic 75/query (21 queries), crud 200/query (5), vendors 20/vendor (21), frameworks 400 each, platforms 17/query, cloud 35/query, api-docs 25/query.

## Validating queries before crawl

Run `npm run test:github-search` to check result counts per query. Queries hitting 1000 are capped by GitHub; path and version splits provide additional headroom.

## 1000-result limit behavior

When a query has more than 1000 results, GitHub returns 422 on page 11+. The crawler handles this gracefully: it logs `[Hit 1000-result limit, stopping pagination for this query]` and continues to the next query. It does not exit.
