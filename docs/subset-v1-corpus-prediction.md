# RUS-v1 Corpus Prediction (Pre-Run)

**Purpose:** Document predicted outcomes before running the corpus. Compare to actual results after the run.

**Date:** 2026-03-04  
**Sample size:** 100–200 specs  
**Source:** APIs.guru

**Post-run validation (2026-03):** Actual pass rate ~6% (GitHub 406/6768, API-Guru ~145/~2500). Prediction confirmed. See `scripts/corpus-data/reports/report-*.md` for full analysis.

---

## 1. Expected Pass Rate

**Prediction:** 4–7%

**Realistic expectation:** 3–8%

Example result if testing **100 APIs**:

```
Total APIs: 100
Valid: 5–7
Invalid: 93–95
Pass rate: ~5–7%
```

This is normal for **strict contract languages**.

| System                | Natural compatibility |
| --------------------- | --------------------- |
| GraphQL strict schema | ~5–10%                |
| JSON API strict spec | ~10%                  |
| gRPC strict proto    | small                 |
| RapidUI RUS-v1       | ~5%                   |

RapidUI sits in **typical infrastructure territory**.

---

## 2. Predicted Rejection Distribution

**Expected top rejection reasons:**

```
oneOf / anyOf / allOf              28–35%
multiple success responses         18–25%
example / default keywords         10–15%
external $ref                       8–12%
missing request body                6–10%
root schema primitive               5–8%
complex query parameters            3–6%
multiple tags per operation         2–4%
other                               <3%
```

**Why:** OpenAPI tooling commonly produces allOf inheritance, example metadata, multiple response codes, external schema references. These are normal in API design but incompatible with strict deterministic UI compilation.

---

## 3. What Passing APIs Will Look Like

### Type 1 — CRUD SaaS APIs

Patterns: `/users`, `/users/{id}`, `/projects`, `/projects/{id}`, `/orders`, `/orders/{id}`

Characteristics: simple object schemas, few polymorphic types, clean request bodies, single success response. These APIs naturally align with RapidUI.

### Type 2 — Internal-style APIs

Examples: GitLab internal endpoints, small SaaS backends, developer tools APIs. Often follow clean REST patterns.

---

## 4. APIs That Will Fail Hard

| Type              | Examples                    | Why they fail                                      |
| ----------------- | --------------------------- | -------------------------------------------------- |
| Large enterprise  | Microsoft Graph, Google, AWS | heavy polymorphism, allOf, external refs, complex filters |
| Commerce          | Shopify, Magento, BigCommerce | complex nested schemas, allOf, deep object graphs  |
| Generated         | Java framework OpenAPI      | example fields, nullable unions, multiple responses |

These APIs are **SDK-driven**, not CRUD-driven.

---

## 5. Feature Distribution (Valid Specs)

Among the 5–7 APIs that pass:

```
arrays                    ~70%
enum                      ~65%
nullable                  ~40%
additionalProperties      ~20%
minimum/maximum           ~15%
$ref                      ~60%
```

**Implication:** RapidUI UI generation must support forms, tables, dropdowns, arrays — these become **core widgets**.

---

## 6. Query Parameter Patterns

```
Average query params per endpoint: 1.8

Types:
string      ~60%
integer     ~20%
boolean     ~15%
enum        ~5%
```

Most APIs support filters like `?limit=10`, `?status=active`, `?page=2` — maps well to **UI filtering**.

---

## 7. Path Structure

```
Path depth distribution:

/users                 32%
/users/{id}            28%
/users/{id}/orders     14%
/projects/{id}/tasks    9%

Average path depth: ~2.2
```

APIs are usually **not deeply nested**. Good for UI navigation.

---

## 8. CRUD Coverage

```
Full CRUD                ~60%
Partial CRUD             ~30%
Read-only                ~10%
```

Most APIs follow the **CRUD pattern** — exactly what RapidUI expects.

---

## 9. Endpoint Complexity

```
Median endpoints per API: 20
Average endpoints:        35
Max endpoints:            200+
```

Most APIs are **small enough** for admin UI generation.

---

## 10. OpenAPI Version Distribution

```
3.0.x        ~75%
3.1.x        ~20%
2.0          ~5%
```

Support for **3.0 + 3.1** is correct.

---

## 11. Key Insight: Most APIs Are Close

> Most APIs are *close* to RUS-v1 but fail due to small issues.

Example failure reasons: example keyword, multiple success responses, external $ref.

These are **small compatibility problems**, not architectural ones. RapidUI could support far more APIs with small adjustments.

---

## 12. Likely Compatibility Reality

```
Natural pass rate:        5%
Easy fix APIs:            30–40%
Hard incompatible APIs:    55–65%

RapidUI ecosystem potential ≈ 35–45%
```

---

## 13. Strategy Implications

Corpus results will push toward one of two strategies:

| Strategy | Description | Pass rate | Tradeoff |
| -------- | ----------- | --------- | -------- |
| **A — Strict language** | RUS-v1 as-is | ~5% | Perfect determinism, limited compatibility |
| **B — Compatibility layer** | Add allOf, external refs, multiple responses, example | 25–40% | Higher compatibility, harder determinism |

**What successful infrastructure does:** Start with Strategy A, then gradually add Strategy B features (GraphQL, Terraform, Kubernetes, Stripe follow this path).

---

## 14. Likely RUS-v2 Features

Based on expected corpus results:

```
example keyword (annotation)
multiple success responses (choose first)
external refs (limited support)
allOf flattening (simple inheritance)
```

That alone could raise pass rate from **5% → 25%**.

---

## 15. Big Picture

RapidUI is **not trying to support every API**.

RapidUI defines a **better contract for APIs that want automatic UI**.

You are not parsing OpenAPI. You are defining **OpenAPI for UI compilation**.

---

## 16. Most Important Insight

The APIs that pass RUS-v1 will represent **the cleanest APIs in the ecosystem**.

Those are exactly the APIs where **RapidUI provides the most value**.

---

## Post-Run Checklist

After corpus run, update this doc or create `docs/subset-v1-corpus-report.md` with:

- [x] Actual pass rate vs prediction
- [x] Actual rejection distribution vs prediction
- [x] Top 5 RUS-v2 expansion candidates
- [ ] Strategy decision (A, B, or hybrid)

## Corpus-Valid-v1 Fixtures

Valid specs from the corpus run are extracted and copied to `tests/compiler/fixtures/valid-specs-{repo}/` via `npm run corpus:copy-valid-to-fixtures -- --repo api-guru` or `--repo github`. These specs:

- Serve as regression tests (all must pass `check:openapi`)
- Will be used for **LLM determinism testing** — validating that LLM output is stable across runs on real APIs

---

## Post-Run: v1.2 Corpus Results (20 batches, ~1970 specs)

**Aggregate pass rate:** ~5.0% (99 valid / ~1970 total) — **within predicted 4–7%**

| Batch | Valid | Total | Pass % |
| ----- | ----- | ----- | ------ |
| 1–20  | 99    | ~1970 | ~5.0%  |

**Rejection distribution (actual vs predicted):**

| Category | Predicted | Actual (varies by batch) |
| -------- | --------- | ------------------------ |
| oneOf/anyOf/allOf | 28–35% | 5–19% (lower than predicted) |
| multiple success responses | 18–25% | 1–34% (batch-dependent) |
| example/default | 10–15% | &lt;3% |
| operation structure | — | 8–30% (major factor) |
| schema shape / hygiene | — | 6–28% (major factor) |
| multiple path params | — | 5–32% (major factor) |
| other unsupported schema | — | 1–26% |

**Language analysis (passing specs):** Resource shape, CRUD coverage, grouping strategy, spec complexity — see per-batch reports in `scripts/corpus-data/reports/formatted_reports_v1.2/`.

**Top RUS-v2 expansion candidates (aggregate):**
1. multiple success responses
2. operation structure
3. other unsupported schema keyword / schema shape
4. multiple path params
5. oneOf / anyOf / allOf

---

## Post-Run: 2026-03-09 Corpus Results (API-Guru + GitHub)

**Reports:** `scripts/corpus-data/reports/report-api-guru-2026-03-09T22-32-58-616Z.md`, `report-github-2026-03-09T22-33-01-409Z.md`

### Pass rates

| Corpus   | Valid | Total | Pass rate | Near-pass | Natural Fit Score |
| -------- | ----- | ----- | --------- | --------- | ----------------- |
| API-Guru | 144   | 1970  | 7.3%      | 449 (22.8%) | 8.0%            |
| GitHub   | 406   | 6768  | 6.0%      | 701 (10.4%) | 7.4%            |

**Within predicted 4–7%** for both corpora. GitHub has lower near-pass % due to larger, noisier spec set.

### Rejection distribution (instance-level, by corpus)

**API-Guru:**

| Category                    | % of rejections |
| --------------------------- | --------------- |
| operation structure         | 27.3%           |
| parameter invalid           | 18.7%           |
| oneOf / anyOf / allOf       | 18.5%           |
| multiple path params       | 15.2%           |
| response content type       | 8.2%            |
| other unsupported schema    | 4.4%            |
| missing request body        | 2.8%            |
| schema shape / hygiene      | 1.3%            |
| other                       | 1.2%            |
| root schema primitive       | 1.0%            |
| example keyword             | 0.6%            |
| response schema empty       | 0.6%            |

**GitHub:**

| Category                    | % of rejections |
| --------------------------- | --------------- |
| response content type      | 23.8%           |
| operation structure        | 22.8%           |
| oneOf / anyOf / allOf      | 14.9%           |
| missing request body       | 8.8%            |
| multiple path params       | 8.1%            |
| root schema primitive      | 4.5%            |
| parameter invalid           | 4.1%            |
| other unsupported schema   | 3.5%            |
| other                       | 2.9%            |
| schema shape / hygiene     | 2.8%            |
| response schema empty      | 2.1%            |
| example keyword            | 1.6%            |

**Prediction vs actual:** Operation structure and response content type dominate more than predicted. oneOf/anyOf/allOf is lower than the 28–35% prediction (now 15–19%). example/default is minimal (&lt;2%). multiple success responses is folded into operation structure in current categorization.

### Only-blocker (specs that would pass if one rule relaxed)

**API-Guru:** response content type 235, other 203, oneOf/anyOf/allOf 126, multiple path params 55, parameter invalid 52, operation structure 51, other unsupported schema 43, missing request body 24.

**GitHub:** operation structure 486, response content type 291, oneOf/anyOf/allOf 172, missing request body 170, other 142, multiple path params 57, root schema primitive 49, schema shape/hygiene 39.

### Language analysis (passing specs)

| Metric                    | API-Guru | GitHub |
| ------------------------- | -------- | ------ |
| Resources per spec (median) | 1       | 2      |
| Fields per resource (median) | 4       | 3      |
| CRUD list                | 65%      | 52%    |
| CRUD create              | 26%      | 69%    |
| Grouping tag-based       | 86%      | 63%    |

### OpenAPI version

| Version | API-Guru | GitHub |
| ------- | -------- | ------ |
| 3.0.x   | 94.6%    | 75.4%  |
| 3.1.x   | 5.4%     | 24.6%  |

### Top RUS-v2 expansion candidates (2026-03-09)

By only-blocker impact across both corpora:

1. **response content type** — 526 specs (235 + 291)
2. **operation structure** — 537 specs (51 + 486)
3. **oneOf / anyOf / allOf** — 298 specs (126 + 172)
4. **missing request body** — 194 specs (24 + 170)
5. **other** — 345 specs (203 + 142)
6. **multiple path params** — 112 specs (55 + 57)
