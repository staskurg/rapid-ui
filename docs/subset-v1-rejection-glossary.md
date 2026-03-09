# RUS-v1 Rejection Glossary

**Purpose:** This document explains what each corpus rejection category means in detail. Use it to understand the exact errors, where they come from in the validator, and how to fix them for RUS-v2.

---

## 1. Operation structure (`OAS_INVALID_OPERATION_STRUCTURE`)

**What it means:** The OpenAPI spec violates RUS-v1 rules about how operations (paths + methods) must be structured. This is a broad category — the validator emits this code for many distinct conditions.

**Exact error messages (from subset-validator.ts):**

| Message | Meaning | Location |
|---------|---------|----------|
| `paths must not be empty` | Document has no paths or empty paths object | `/paths` |
| `Path must have at least one supported operation (GET, POST, PUT, PATCH, DELETE)` | Path item exists but has no GET/POST/PUT/PATCH/DELETE | `/paths/{path}` |
| `Operation must have at least one success response (200 or 201)` | Operation has no 200 or 201 response | `{opPath}` |
| `GET must not have requestBody` | GET operation defines a request body (RUS-v1 forbids this) | `{opPath}` |
| `DELETE must not have requestBody` | DELETE operation defines a request body | `{opPath}` |
| `POST requires requestBody` | POST has no requestBody | `{opPath}` |
| `PUT requires requestBody` | PUT has no requestBody | `{opPath}` |
| `PATCH requires requestBody` | PATCH has no requestBody | `{opPath}` |
| `requestBody content must include application/json` | requestBody has no `application/json` (multiple content types allowed; JSON selected when present) | `{opPath}/requestBody` |
| `requestBody content must have schema for application/json` | requestBody has `application/json` but no schema (or empty schema) | `{opPath}/requestBody/content/application~1json` |
| `Document must have at least one valid CRUD operation` | After filtering, no path has any supported method | `/paths` |

**Why RUS-v1 enforces this:** CRUD UI generation assumes deterministic operation shapes. GET/DELETE without body, POST/PUT/PATCH with exactly `application/json` schema — this locks the compiler to predictable patterns.

**RUS-v2 expansion ideas:** Relax GET-with-body (ignore it); allow multiple content types (pick first JSON); document which ops are "CRUD-like" vs informational.

---

## 2. Schema shape / hygiene (`OAS_INVALID_SCHEMA_SHAPE`)

**What it means:** A schema (in request body, response, or parameter) violates structural rules. These are not "unsupported keywords" — they're malformed or overly permissive shapes that RUS-v1 rejects for determinism.

**Exact error messages:**

| Message | Meaning | Typical location |
|---------|---------|------------------|
| `When $ref is present, only annotation keys (nullable, readOnly, title, deprecated, description) are allowed; found structural key: {key}` | Schema has `$ref` plus structural keys (e.g. `properties`, `type`, `items`) — annotation keys allowed | Any schema with `$ref` |
| `additionalProperties must be false, true, or a schema object` | `additionalProperties` has invalid value (e.g. array) | Object schemas |
| `required references non-existent property: {name}` | `required` array lists a property not in `properties` | Object schemas |
| `type: array requires items` | Array schema has no `items` | Array schemas |
| `array of array is not supported` | `items` is itself `type: array` — nested arrays rejected | Array schemas |
| `enum values must match type: string` | Enum has non-string values but type is string | Enum schemas |
| `enum values must match type: integer` | Enum has non-number values | Enum schemas |
| `enum values must match type: number` | Same | Enum schemas |
| `enum values must match type: boolean` | Same | Enum schemas |

**Why RUS-v1 enforced this:** Closed objects (`additionalProperties: false`) enable safe form generation. `required ⊆ properties` avoids broken references. Array-of-array and `$ref`+structural-keys add complexity.

**RUS-v2 (implemented):** `additionalProperties: false` → closed object; `true` → map&lt;string,unknown&gt;; schema → map&lt;string,schema&gt;. `$ref` + annotation keys (`nullable`, `readOnly`, `title`, `deprecated`, `description`) allowed. Empty object (`type: object` without properties) allowed.

---

## 3. Response content type (`OAS_INVALID_RESPONSE_STRUCTURE` — content-related)

**What it means:** The success response (200 or 201) does not declare `application/json` as a content type, or the content structure is wrong.

**Exact error messages:**

| Message | Meaning | Location |
|---------|---------|----------|
| `Success response must have content with application/json` | Response has no `content` object at all | `{opPath}/responses/{code}` |
| `Success response content must include application/json` | Response has `content` but the keys are not `application/json` (e.g. `text/plain`, `application/xml`, or multiple types) | `{opPath}/responses/{code}/content` |
| `Success response must have schema` | `content["application/json"]` exists but has no `schema` (or schema is empty) | `{opPath}/responses/{code}/content/application~1json` |

**Why RUS-v1 enforces this:** The compiler generates JSON-based CRUD UIs. Non-JSON responses (XML, text, binary) require different handling. RUS-v1 picks the first success response and requires exactly `application/json` with a schema.

**Common real-world cases:**
- Response declares `text/plain` or `application/xml` only
- Response has both `application/json` and `application/xml` — RUS-v1 requires `application/json` to be present (v1.2 uses it if present)
- Response has `content` but only `application/octet-stream` or similar

**RUS-v2 expansion ideas:** If multiple content types, pick `application/json` when present; add optional support for `text/plain` string responses.

---

## 4. Multiple path params (`OAS_MULTIPLE_PATH_PARAMS`)

**What it means:** A path template has more than one path parameter. RUS-v1 supports at most one path param per path (e.g. `/users/{id}` but not `/users/{userId}/orders/{orderId}`).

**Exact error message:**

| Message | Meaning | Example path |
|---------|---------|--------------|
| `Path has multiple path parameters: {param1}, {param2}` | Path contains 2+ `{param}` segments | `/users/{userId}/orders/{orderId}` |

**Why RUS-v1 enforces this:** The compiler maps paths to resources with a single identifier. Nested resources (e.g. `/users/{id}/orders/{orderId}`) require multi-level navigation and different routing — not in v1 scope.

**RUS-v2 expansion ideas:** Support 2 path params with hierarchical resource model; or flatten to `/{resource1}/{id1}/{resource2}/{id2}` with explicit parent-child semantics.

---

## 5. Other rejection categories (reference)

| Category | Error code(s) | Brief meaning |
|----------|---------------|----------------|
| oneOf / anyOf / allOf | OAS_UNSUPPORTED_SCHEMA_KEYWORD | Schema uses composition keywords |
| other unsupported schema keyword | OAS_UNSUPPORTED_SCHEMA_KEYWORD | Schema uses disallowed keyword (e.g. discriminator, not, etc.) |
| example keyword | OAS_UNSUPPORTED_SCHEMA_KEYWORD | Schema has `example` (v1.1 allows but may still reject in some flows) |
| default keyword | OAS_UNSUPPORTED_SCHEMA_KEYWORD | Schema has `default` |
| response structure (other) | OAS_INVALID_RESPONSE_STRUCTURE | Root schema primitive, empty schema, etc. |
| root schema primitive | OAS_INVALID_RESPONSE_STRUCTURE | Success schema resolves to string/number/boolean |
| missing request body | OAS_MISSING_REQUEST_BODY | POST/PUT/PATCH without requestBody |
| external $ref | OAS_EXTERNAL_REF / resolve stage | $ref points outside document |
| circular $ref | OAS_CIRCULAR_REF | $ref cycle detected |
| parameter invalid | OAS_INVALID_PARAMETER | Path/query param schema invalid |

---

## Implementation strategy for monitoring

1. **Corpus run** — Keep raw output with full `errors[]` (code, message, jsonPointer).
   ```bash
   npm run corpus:run -- --repo api-guru
   npm run corpus:run -- --repo github
   ```

2. **Corpus report** — For each category, the report now outputs:
   - Total count and %
   - **Per-message breakdown** — count and % for each exact message within the category
   - Example spec filenames (first 3) that hit each message
   ```bash
   npm run corpus:report -- --repo api-guru
   npm run corpus:report -- --repo github
   ```

3. **Rejection glossary** — This document; linked from each report.

4. **Next run** — After corpus:run + corpus:report, each report will show e.g.:
   - "operation structure: 26.2% — breakdown: requestBody content must have exactly one key (12%), Operation must have at least one success response (8%), ..."

This granularity tells you exactly which validator rules to relax first for RUS-v2. Compare API-Guru vs GitHub reports to see corpus-specific patterns (e.g. response content type higher on GitHub).
