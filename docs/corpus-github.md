# GitHub Corpus Workflow

Crawl OpenAPI specs from GitHub, validate them, and run the corpus pipeline. Part of the RUS-v1 corpus pipeline — see [openapi-subset-v1.md](openapi-subset-v1.md) § Corpus Workflow for the full pipeline.

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

Output: `scripts/corpus-data/specs/github/` (group-generic, group-frameworks/\*, group-crud, group-vendors, etc.)

### 2. Run validation

```bash
# All GitHub specs (recursive from specs/github)
npm run corpus:run -- --repo github

# Or per group (advanced)
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-generic --output-name github-generic
npm run corpus:run -- --specs-dir scripts/corpus-data/specs/github/group-frameworks --output-name github-frameworks --recurse
# ... etc
```

Output: `scripts/corpus-data/reports/raw-github-{timestamp}.json` (or raw-github-{group}-\*.json for per-group)

### 3. Report (optional)

```bash
# Auto-find latest raw-github-*.json
npm run corpus:report -- --repo github

# Or pass explicit path
npm run corpus:report -- scripts/corpus-data/reports/raw-github-{timestamp}.json
```

### 4. Extract valid specs + copy to fixtures

```bash
# GitHub only → tests/compiler/fixtures/valid-specs-github
npm run corpus:copy-valid-to-fixtures -- --repo github

# API Guru only → tests/compiler/fixtures/valid-specs-api-guru
npm run corpus:copy-valid-to-fixtures -- --repo api-guru
```

Output: `rapidui-corpus-valid-v1-{repo}.json`, `rapidui-corpus-valid-v1-{repo}.txt`, and copies to `tests/compiler/fixtures/valid-specs-{repo}/`

### 5. Generate ApiIR + pattern mining

```bash
npm run fixtures:generate-apiir
npm run corpus:pattern-mining -- --repo github --output scripts/corpus-data/reports/pattern-mining-github-$(date +%Y-%m-%d).md
```

## Quick pipeline test (after `--limit 2` crawl)

```bash
# Step 2: Validate all GitHub specs
npm run corpus:run -- --repo github

# Step 3: Report (optional)
npm run corpus:report -- --repo github

# Step 4: Extract valid + copy to fixtures
npm run corpus:copy-valid-to-fixtures -- --repo github

# Step 5: ApiIR + pattern mining
npm run fixtures:generate-apiir
npm run corpus:pattern-mining -- --repo github --output scripts/corpus-data/reports/pattern-mining-test.md
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
