# RUS-v1 Corpus Prediction (Pre-Run)

**Purpose:** Document predicted outcomes before running the corpus. Compare to actual results after the run.

**Date:** 2025-03-04  
**Sample size:** 100–200 specs  
**Source:** APIs.guru

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

- [ ] Actual pass rate vs prediction
- [ ] Actual rejection distribution vs prediction
- [ ] Top 5 RUS-v2 expansion candidates
- [ ] Strategy decision (A, B, or hybrid)
