# RapidUI MVP v3 — Subset Hardening Implementation

**Goal:** Lock the OpenAPI → Canonical → ApiIR → UiPlanIR (LLM) → UISpec → UI compiler contract.  
**Principle:** No new subset relaxations.

---

## Phase 1 — Lock the Validator Behavior

**File:** `lib/compiler/openapi/subset-validator.ts`

### 1. Success-response invariant

Replace all response-content variants with one rule:

```
Operation must have success response with JSON schema
```

**Trigger when:**

- no success response
- OR no JSON media type
- OR JSON media type without schema

Keep separate error for primitive root responses.

**Add hint to error message:**

```
RapidUI requires a JSON response body to generate UI.
```

**Documentation** (in `docs/openapi-subset-v1.md`):

```
An operation must expose a success response containing a JSON schema.
RapidUI currently treats HTTP 200 and 201 responses as success responses during validation.
```

---

### 2. Unsupported keyword hints

Add:

```ts
const UNSUPPORTED_HINTS: Record<string, string> = {
  oneOf: 'RapidUI does not support polymorphic schemas.',
  anyOf: 'RapidUI does not support polymorphic schemas.',
  allOf: 'RapidUI does not support schema composition.',
  discriminator: 'RapidUI does not support polymorphic schemas.',
};
```

Emit:

```
Unsupported schema keyword: oneOf
RapidUI does not support polymorphic schemas.
```

Keep `OAS_UNSUPPORTED_SCHEMA_KEYWORD`. Do not introduce new error codes.

---

## Phase 2 — Determinism + Canonicalization Tests

**File:** `tests/compiler/canonical.test.ts`

Add six groups of tests.

### 1. Annotation stripping

Ensure canonical output is identical when these are added/removed:

- `description`
- `deprecated`
- `xml`
- `externalDocs`
- `uniqueItems`

**Assertion:** `canonical(specA) === canonical(specB)`

---

### 2. Media type ordering

**Spec A:** `content` has `application/xml` first, then `application/json`  
**Spec B:** `content` has `application/json` first, then `application/xml`

**Expected:** same canonical output

---

### 3. Media-type noise

**Spec A:** `content` has `application/xml` + `application/json`  
**Spec B:** `content` has only `application/json`

**Expected:** same ApiIR hash (XML ignored; JSON selected deterministically)

---

### 4. Contract change detection

Add/remove field → `hashA !== hashB`

---

### 5. Parameter ordering noise

These two specs should produce identical ApiIR:

```yaml
parameters:
  - name: limit
    in: query
    schema: { type: 'integer' }
  - name: offset
    in: query
    schema: { type: 'integer' }
```

vs

```yaml
parameters:
  - name: offset
    in: query
    schema: { type: 'integer' }
  - name: limit
    in: query
    schema: { type: 'integer' }
```

**Expected:** same ApiIR hash

---

### 6. Property order noise

These should compile identically:

```yaml
properties:
  id:
    type: string
  name:
    type: string
```

vs

```yaml
properties:
  name:
    type: string
  id:
    type: string
```

**Expected:** same ApiIR hash

---

## Phase 3 — Subset Contract Documentation

**File:** `docs/openapi-subset-v1.md`

Add or refine these sections.

### Compiler Invariant

```
OpenAPI → Canonical Spec → ApiIR → UiPlanIR (LLM) → UISpec → UI
```

**Guarantees:**

- Same OpenAPI spec always produces identical UI
- Annotation changes do not affect output
- Contract changes produce deterministic UI diffs

### Supported

- OpenAPI 3.0 / 3.1
- JSON media types
- Object schemas
- Arrays with items
- Map types via additionalProperties

### Unsupported

- oneOf / anyOf / allOf
- discriminator
- multiple path params
- non-JSON responses
- primitive root responses
- action endpoints (POST without body)
- external $ref
- circular $ref

### Normalization

- multiple media types → JSON selected
- annotation keys stripped
- nullable normalized

---

## Phase 4 — Other Bucket Analysis (Optional)

**File:** `scripts/corpus-report.ts`

Add report section:

```markdown
### Other bucket breakdown

| Sub-rule | Specs affected |
```

Visibility only. No rule changes.

---

## Phase 5 — Corpus Rerun

```bash
npm run corpus:run -- --repo api-guru
npm run corpus:run -- --repo github

npm run corpus:report -- --repo api-guru
npm run corpus:report -- --repo github
```

**Expected pass rates:**

| Corpus   | Pass Rate |
| -------- | --------- |
| API-Guru | ~7%       |
| GitHub   | ~6%       |

Investigate if pass rate changes significantly.

---

## Phase 6 — Freeze

**1. Add to `docs/openapi-subset-v1.md`:**

```markdown
## RUS-v1 Freeze

The RapidUI OpenAPI Subset v1 is frozen for MVP v3.

No new relaxations will be added during this sprint.
Future compatibility work will occur in RUS-v2.
```

**2. Add README section** (`README.md`):

```markdown
## OpenAPI Subset

RapidUI compiles a deterministic subset of OpenAPI into UI.

The subset is documented here: [docs/openapi-subset-v1.md](docs/openapi-subset-v1.md)

This subset is frozen for MVP v3.
```

---

## Constraints (Do Not Implement)

- multiple path params
- allOf flattening
- action endpoints
- primitive root UI
- non-JSON responses

These are v2 features.

---

## Execution Order

| Hour | Tasks                                                                         |
| ---- | ----------------------------------------------------------------------------- |
| 0–1  | Validator: success-response rule + unsupported hints                          |
| 1–3  | Tests: canonicalization, determinism, media-type noise, parameter order noise |
| 3–4  | Docs: subset contract, compiler invariant, README pointer                     |
| 4–5  | Optional: other bucket breakdown. Run `corpus:report`. Observe only.          |
| 5    | Corpus rerun. Record pass rate.                                               |
| 6    | Freeze subset.                                                                |
