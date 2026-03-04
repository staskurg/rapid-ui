# RUS-v1 Corpus Report Requirements

**Purpose:** Define the structure and content of the Phase 4 corpus report. The corpus report is the **empirical map of the OpenAPI ecosystem** — it tells you how reality differs from RUS-v1 language design and determines the RUS-v2 roadmap.

> The corpus report answers: *How many real APIs naturally fit into RUS-v1, and why don't others?*

---

## Report Structure: Four Layers

The report covers four layers of insight:

| Layer | Focus | Key metrics |
| ----- | ----- | ----------- |
| **1. Compatibility** | Pass rate, near-pass, fixability, endpoint coverage | Pass rate; near-pass %; fix cost distribution; endpoint coverage; Natural Fit Score |
| **2. Ecosystem Structure** | API patterns, schema composition, path structure | CRUD patterns; schema reuse; complexity; path depth |
| **3. Language Design** | Rejection reasons, feature usage, error locations | Rejection distribution; feature presence; error location heatmap; compatibility projection |
| **4. System Health** | Compiler stability, performance, IR size | Determinism; compile time; crash count; IR metrics |

---

## Report Deliverable

The corpus run produces per-batch reports: **`scripts/corpus-data/reports/report-batch{N}-{timestamp}.md`**. Copy to `docs/subset-v1-corpus-report.md` only when publishing a final synthesis. This document specifies what each report must contain.

**Corpus workflow:** Specs in `scripts/corpus-data/specs/{N}/` (pre-filtered 3.0/3.1) → `corpus:run --batch N` → raw JSON → `corpus:report` → report MD. Valid specs extracted via `corpus:extract-valid` and optionally copied to `tests/compiler/fixtures/corpus-valid-v1/` for regression and LLM determinism testing. See plan Phase 4 Implementation Details.

---

## Layer 1: Compatibility Metrics

### 1.1 Core Metric: Pass Rate (Required)

**Required output:**

```
Total specs tested: N
Valid (RUS-v1 compliant): M
Pass rate: X%
```

**Interpretation guide:**

| Pass rate | Interpretation |
| --------- | -------------- |
| <1% | Subset too strict |
| **4–7%** | **Strong contract language** (predicted range) |
| 20–30% | More compatibility |
| 80%+ | Too loose, not deterministic |

**Why it matters:** A single number that validates or invalidates the prediction. The 4–7% range signals you're building a **language**, not a parser — similar to strict-mode compilers that shape ecosystems.

---

### 1.2 Near-Pass Analysis (Required — Very Important)

Specs are either VALID or INVALID, but many fail for **only one small reason**. If you removed that one rule, the spec would pass.

**Required output:**

```
NEAR-PASS ANALYSIS

Specs failing with only one violation: XX%

Top single-failure reasons:
example keyword                XX%
multiple success responses     XX%
external $ref                  XX%
...
```

**Why it matters:** Tells you **which rule change would unlock the most APIs**. Example: if removing "example rejection" increases pass rate from 6% → 18%, that's huge product information. One of the most valuable metrics.

---

### 1.3 Fixability Cost (Required)

Some rejected APIs are easy to fix; others require redesigning the API.

**Required output:** Classify each rejection category by fix cost:

| Fix cost | Definition | Example issues |
| -------- | ---------- | -------------- |
| **Trivial** | Remove keyword or pick first option | example, multiple success (pick first) |
| **Medium** | Schema refactor or flattening | allOf inheritance, external $ref |
| **Hard** | API redesign required | complex polymorphism, nested paths |

```
REJECTION FIX COST

Low effort fixes:        XX%
Medium effort fixes:     XX%
High effort fixes:       XX%
```

**Why it matters:** RapidUI is not only "which APIs pass" but "which APIs can easily become compatible." Example: 6% pass naturally + 40% easy fixes = **ecosystem potential 46%**.

---

### 1.4 Endpoint Coverage (Required)

A spec may fail globally but **some endpoints might still compile**.

**Required output:**

```
ENDPOINT COVERAGE

Total endpoints across corpus: X
Endpoints compatible with RUS-v1: Y
Coverage: Z%
```

**Why it matters:** Pass rate (6%) vs endpoint coverage (42%) tells a very different story. RapidUI might support **most CRUD endpoints** even in complex APIs.

**Implementation note:** Requires per-endpoint validation or partial compilation. **v1 decision:** Defer; report as "N/A" or "deferred to v2".

---

### 1.5 RUS-v1 Natural Fit Score (Required — Strategic)

**Definition:** `natural_fit = pass_rate + easy_fix_rate`

**Required output:**

```
RUS-v1 NATURAL FIT SCORE

Pass rate:        6%
Easy fix rate:    35%
Natural fit:      41%
```

**Why it matters:** The **true compatibility of RapidUI with the API ecosystem**. Single strategic metric for product positioning.

---

## Layer 2: Ecosystem Structure

### 2.1 Schema Reuse / Ref Graph (Recommended)

Track how much schema composition APIs use.

**Required output:**

```
Schema reuse metrics:

Average $ref count per API: X
Max $ref depth: Y
```

**Why it matters:** Predicts whether you'll need allOf flattening, ref normalization in RUS-v2.

---

## Layer 3: Language Design

### 3.1 Rejection Reason Distribution (Required — Highest Priority)

**Required output:** Table of rejection reasons ranked by frequency.

```
Rejection reasons (frequency):

oneOf / anyOf / allOf              XX%
multiple success responses         XX%
example keyword                    XX%
external $ref                      XX%
missing request body               XX%
root schema primitive             XX%
query param complex schema         XX%
multiple tags per operation        XX%
[other categories]                 XX%
```

**Mapping to error codes:** Categorize by `CompilerErrorCode` where applicable:

| Error code | Report category |
| ---------- | --------------- |
| `OAS_UNSUPPORTED_SCHEMA_KEYWORD` | oneOf/anyOf/allOf, example, default, pattern, etc. (split by message/keyword) |
| `OAS_INVALID_SCHEMA_SHAPE` | required⊆properties, array→items, object→properties, enum↔type, additionalProperties |
| `OAS_INVALID_OPERATION_STRUCTURE` | empty paths, no supported ops, path-level params, missing request body, GET/DELETE with body, zero ops |
| `OAS_INVALID_RESPONSE_STRUCTURE` | multiple success, wrong content type, empty schema, root schema primitive |
| `OAS_INVALID_PARAMETER` | path param non-primitive, query param complex schema |
| `OAS_EXTERNAL_REF` / `OAS_CIRCULAR_REF` | external $ref, circular ref |
| `OAS_AMBIGUOUS_RESOURCE_GROUPING` | mixed tags, multiple tags per op |

**Why it matters:** This is the **RUS-v2 roadmap**. Top 10 rejection reasons ranked by frequency = prioritized expansion candidates.

---

### 3.2 Error Location Heatmap (Recommended)

Track **where** failures occur in the spec structure.

**Required output:**

```
FAILURE LOCATION

schema definitions       XX%
responses                XX%
parameters               XX%
request bodies           XX%
paths / operations       XX%
```

**Why it matters:** Identifies where real APIs differ from RUS-v1 assumptions. Informs validation UX and error messaging.

---

### 3.3 Feature Presence in Valid Specs (Required)

**Required output:** For specs that **passed** validation, track which RUS-v1 features appear:

```
Feature usage in passing specs:

enum                    XX%
arrays                  XX%
nullable                XX%
additionalProperties    XX%
minimum/maximum         XX%
$ref                    XX%
```

**Why it matters:** Informs UI feature prioritization. Example: if enums appear in 70%+ of valid APIs → dropdown UI is core.

---

### 3.4 Compatibility Projection (Recommended)

Project pass rate if specific rules were relaxed.

**Required output:**

```
COMPATIBILITY PROJECTION

Current pass rate: 6%

If we add support for:
- example keyword              → projected +X%
- multiple success responses   → projected +Y%
- external refs               → projected +Z%
Combined projected pass rate: ~23%
```

**Why it matters:** Helps plan **RUS-v2 scope** with data. Prioritize expansions by impact.

---

## Layer 2: Ecosystem Structure

### 2.3 Spec Complexity Metrics (Required)

**Required output:**

```
Average endpoints per API: X
Median endpoints: Y
Max endpoints: Z

Average schema depth: X
Max schema depth: Y

Average properties per object: X
```

**Why it matters:** Predicts UI complexity scaling, form depth, performance constraints.

---

### 2.4 CRUD Pattern Distribution (Required)

RapidUI is fundamentally a **CRUD UI generator**. Track operation patterns.

**Required output:**

```
CRUD pattern distribution:

Collection GET (/users)         XX%
Item GET (/users/{id})          XX%
POST create                     XX%
PUT/PATCH update                XX%
DELETE                          XX%

CRUD completeness:
Full CRUD (GET+POST+PUT+DELETE):  XX%
Partial CRUD:                     XX%
Read-only:                        XX%
```

**Why it matters:** If most APIs follow CRUD patterns, RapidUI aligns naturally. Optimize UI generation for real usage.

---

### 2.5 Resource Path Patterns (Recommended)

**Required output:**

```
Top resource path patterns:
/users                 XX%
/accounts              XX%
/products              XX%
...
```

**Why it matters:** Optimize UI generation for real usage patterns.

---

### 2.7 Response Schema Shapes (Recommended)

**Required output:**

```
Root response type (valid specs):
object         XX%
array          XX%

Common property types:
string        XX%
number        XX%
boolean       XX%
array         XX%
object        XX%
```

**Why it matters:** Informs widget design. Root primitive (rejected) should be tracked separately.

---

### 2.8 Query Parameter Behavior (Recommended)

**Required output:**

```
Average query params per endpoint: X

Common query param types:
string       XX%
integer      XX%
boolean      XX%
enum         XX%
```

**Why it matters:** Informs search/filter UI design.

---

### 2.9 Path Structure Patterns (Recommended)

**Required output:**

```
Path depth distribution:
/users                     XX%
/users/{id}                XX%
/users/{id}/orders         XX%

Nested resources: XX%
```

**Why it matters:** Affects UI navigation hierarchy.

---

### 2.6 OpenAPI Version Distribution (Required)

**Required output:**

```
OpenAPI versions:
3.0.x      XX%
3.1.x      XX%
2.0        XX% (if supported; otherwise note as rejected)
```

**Why it matters:** Legacy support prioritization.

---

## Layer 4: System Health

### 4.1 Determinism Metrics (Required)

**Required output:**

```
Determinism checks:
Spec compile hash stable:           100%
Equivalent spec forms → same IR:    100%
Canonicalization stable:            100%
```

**Why it matters:** If any value drops below 100%, it's a **critical bug**. Must verify during corpus run.

---

### 4.2 Compilation Time Metrics (Recommended)

**Required output:**

```
Compiler performance:

Average compile time: X ms
Max compile time: Y ms
```

**Why it matters:** Infrastructure products must track this early. Becomes important when specs are large.

---

### 4.3 Compiler Crash Detection (Required)

**Required output:**

```
Compiler stability:
Compiler crashes:    0
Unhandled errors:    0
Parse failures:      N (excluded from crash count)
```

**Why it matters:** If crash count ever becomes non-zero, it's a **serious bug**. Must be 0. **Parse failures** (invalid YAML, malformed spec) are separate — do not count as compiler crash.

---

### 4.4 IR Size Metrics (Recommended)

**Required output:**

```
Generated ApiIR metrics (valid specs):

Average resources per API: X
Average fields per resource: Y
```

**Why it matters:** Size of generated UI trees. Important for frontend performance.

---

## Additional Sections

### Spec Sampling Method (Required — Scientific Credibility)

**Required output:**

```
Sampling method:

Source: APIs.guru
Selection: [random / stratified / full list]
Total available: ~2000 APIs
Sample size: 100
```

**Why it matters:** Makes the report **credible**. Document methodology.

---

### Top Spec Outliers (Recommended)

**Required output:**

```
Largest API tested:
Provider: X
Endpoints: 312
Compile result: FAIL (reason)

Most complex schema depth:
Depth: 11
Provider: Y
```

**Why it matters:** Understand **edge cases**.

---

### Real API Examples (Recommended)

Include **3–5 real specs**:

```
Example PASS API
Provider: [name]
Endpoints: N
Features used: enums, arrays

Example FAIL API
Provider: [name]
Reason: heavy use of allOf inheritance
```

**Why it matters:** Excellent internal documentation. Grounds discussion in reality.

---

### Spec Size Distribution (Recommended)

**Required output:**

```
Spec sizes (by endpoint count):
Small (<10)      XX%
Medium (10–50)   XX%
Large (50–200)   XX%
Huge (>200)      XX%
```

**Why it matters:** UI complexity scaling assumptions.

---

### API Domain / Category (Optional)

**Optional output:** If metadata available (e.g. from APIs.guru):

```
API domains:
SaaS APIs        XX%
Cloud infra      XX%
Payments         XX%
...
```

**Why it matters:** Target market definition.

---

## Example Report Structure (Template)

```markdown
# RapidUI RUS-v1 Corpus Report
**Date:** YYYY-MM-DD

## SAMPLING METHOD
Source: APIs.guru
Selection: random
Total available: ~2000 APIs
Sample size: 100

## LAYER 1: COMPATIBILITY
Pass rate: M/N (X%)
Near-pass (single violation): XX%
Endpoint coverage: Y/Z (W%)
Fix cost: Low XX% | Medium XX% | High XX%
Natural Fit Score: pass_rate + easy_fix_rate = XX%

## LAYER 2: ECOSYSTEM
[CRUD patterns, schema reuse, complexity, path structure]

## LAYER 3: LANGUAGE DESIGN
[Top rejection reasons, error location heatmap, feature presence]
Compatibility projection: [if we add X, Y, Z → ~XX%]

## LAYER 4: SYSTEM HEALTH
Determinism: 100%
Compile time: avg X ms, max Y ms
Compiler crashes: 0
IR metrics: [resources, fields]

## RUS-v2 ROADMAP IMPLICATIONS
[Top 5 expansion candidates based on rejection distribution]

## EXAMPLES
[3–5 real PASS and FAIL API examples]
```

---

## Implementation Notes

### Data collection

- Run `npm run check:openapi -- <spec>` for each spec
- Capture: exit code, stdout (VALID/INVALID), stderr (error details), **violation count**
- For invalid specs: parse error output to extract `code`, `message`, `jsonPointer`
- For valid specs: optionally run lightweight schema traversal to collect feature presence
- For near-pass: count violations per spec; single-violation specs get special categorization

### Rejection categorization

- Map `CompilerErrorCode` + `message` to report categories
- **All errors per spec** (aggregate) — enables near-pass analysis and full rejection distribution
- "Other" bucket for uncategorized; aim to keep <5%

### Fixability cost classification

Pre-define mapping from rejection category to fix cost:

| Category | Typical fix cost |
| -------- | ---------------- |
| example, default | Trivial |
| multiple success (pick first) | Trivial |
| external $ref | Medium |
| allOf / oneOf | Medium |
| complex polymorphism, nested paths | Hard |

### Sample size

- **Start with 100 specs.** Patterns emerge quickly.
- Scale to 200 if time permits.
- Document sampling method (random, stratified by version, etc.)

---

## Strategic Value

The corpus report is not just testing the compiler. It answers:

> **Are APIs naturally compatible with RapidUI?**

- **Pass rate** → Validates prediction; 4–7% = strong contract language
- **Natural Fit Score** (pass + easy fix) → True ecosystem compatibility; e.g. 6% + 35% = 41% potential
- **Near-pass analysis** → Which rule change unlocks the most APIs
- **Endpoint coverage** → May support most CRUD endpoints even when full spec fails
- **Rejection distribution** → RUS-v2 roadmap is data-driven
- **Feature presence** → UI prioritization is evidence-based

---

## Priority Summary: Four Critical Additions

The following four metrics unlock the most strategic insight (per platform-company practice):

| # | Metric | Why critical |
|---|--------|--------------|
| 1 | **Near-pass analysis** | Which rule change unlocks the most APIs |
| 2 | **Fixability cost** | Pass + easy fix = true ecosystem potential |
| 3 | **Endpoint coverage** | May support most CRUD endpoints even when full spec fails |
| 4 | **CRUD pattern distribution** | RapidUI is a CRUD UI generator; alignment with reality matters |

---

## Related Documentation

- [RUS-v1 Spec](openapi-subset-v1.md) — language definition
- [Corpus Prediction](subset-v1-corpus-prediction.md) — pre-run prediction (4–7%)
- [OpenAPI Compiler](openapi-compiler.md) — pipeline and error taxonomy
- **Phase 4 implementation:** See `.cursor/plans/rapidui_subset_v1_plan_e1897cca.plan.md` § Phase 4 Implementation Details — corpus-run script, corpus-report script, raw data format, NPM scripts
