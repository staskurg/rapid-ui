# RapidUI OpenAPI Subset v1 (RUS-v1)

**Single source of truth** for the RapidUI OpenAPI subset. RUS-v1 is a formally defined language with an **allowlist**—only supported constructs exist; everything else is a compile error.

> RapidUI is a constrained OpenAPI language for deterministic internal UI compilation.

---

## 1. Supported OpenAPI Versions

- **OpenAPI 3.0.x** — supported
- **OpenAPI 3.1.x** — supported
- Document must have `paths`; `components.schemas` if referenced

### Rejections

- **Empty paths:** `paths: {}` or `Object.keys(paths).length === 0` → reject. Message: "paths must not be empty"
- **Zero operations globally:** If after Subset validation and ref resolution there are zero valid CRUD operations → reject. Prevents "VALID but empty UI"

---

## 2. Supported Path Structure

### Allowed HTTP methods

| Method | Supported |
| ------ | --------- |
| GET    | ✅ |
| POST   | ✅ |
| PUT    | ✅ |
| PATCH  | ✅ |
| DELETE | ✅ |

- **Unsupported methods:** Ignored (not rejected)
- **Path must have at least one supported operation** → else reject (no empty-path grouping)

---

## 3. Resource Grouping Rules

Algorithmically explicit:

1. **If all operations have exactly one tag** → tag grouping (group by tag name)
2. **If none have tags** → path grouping (strip `api`, `v1`, `v2`, `v3`; use first segment)
3. **Mixed (some tagged, some not)** → reject. No mixing.
4. **Multiple tags per operation** → reject

---

## 4. Supported Response Rules

- **Exactly one success code in {200, 201}.** Missing (zero) success response → reject
- No other 2xx allowed (204, 206, etc. → reject)
- Only `application/json`. Content object must have exactly one key
- **Success response must have `schema`** — empty schema or missing schema → reject
- **Root success schema must resolve to object or array** — reject `type: string`, `type: number`, `type: boolean` at root (CRUD assumes structured data). Root-type validation must follow `$ref`

---

## 5. Request Body Rules

- **POST, PUT, PATCH must have requestBody** with `application/json` schema
- **GET and DELETE must NOT have requestBody**
- Reject GET/DELETE with body; reject POST/PUT/PATCH without body

---

## 6. Supported Schema Subset (Allowlist)

### Allowed schema keywords only

`type`, `properties`, `required`, `items`, `enum`, `nullable`, `format`, `description`, `$ref`, `additionalProperties`, `minimum`, `maximum`

- **Unknown schema keyword → compile error** (`OAS_UNSUPPORTED_SCHEMA_KEYWORD`)
- **$ref rule:** If `$ref` exists, only `$ref` and `description` allowed. No other keys (e.g. `$ref` + `type: object` → reject)

### Annotation-only (accepted but ignored structurally)

`description`, `format`, `minimum`, `maximum` — they do not affect UI structure or validation. If later add numeric validation UI → RUS-v2.

### Numeric types

Internal canonical numeric type = `number`. `integer` and `number` treated equivalently in ApiIR. UI does not distinguish them structurally.

### additionalProperties

Must be `false` if present. Does NOT change UI structure; accepted but ignored structurally.

### Rejected (explicit)

`oneOf`, `anyOf`, `allOf`, `not`, `discriminator`, `patternProperties`, `pattern`, `example`, `default`, etc.

### Schema hygiene (compiler invariants)

- **required:** Every entry in `required` must exist in `properties`. Else → compile error
- **array:** If `type: array` → `items` must exist and be valid schema. **Allow:** array of object, array of primitive (string, number, integer, boolean). **Reject:** array of array
- **object:** If `type: object` → must have `properties`. Empty object without properties → reject
- **enum:** If `enum` present → values must match declared `type` (string enum → string values; integer enum → number values). Else → compile error

---

## 7. Reference Rules

- Internal `$ref` only; no external; no circular
- Circular detection: stack-based graph traversal (handles direct and indirect multi-hop cycles)

---

## 8. Parameter Rules

### Path params

- A path template may contain at most one `{param}` placeholder (per path string, not per operation)
- Type must be `string` or `integer` (primitive only)

### Parameters location

For v1, parameters must be declared at **operation level only**. Path-level parameters → reject.

### Query params

- Same allowlist and hygiene as request/response schemas
- For v1, query param schemas must resolve to **primitive only** (string, integer, number, boolean)
- **After ref resolution**, query parameter schema must resolve to primitive—reject `$ref` to object schema
- No object, no array of object, no nested

---

## 9. Determinism Requirements

- **Nullable normalization:** Canonical internal representation = `nullable` boolean. `type: ["string","null"]` (OAS 3.1) normalized to `(type: string, nullable: true)`. Both forms must produce identical ApiIR
- **nullable + required:** `nullable` does not affect required semantics at UI level in v1
- **Canonical sorting:** Path level, operation level, property level. Specs differing only in path order or operation order → identical ApiIR hash
- **Resource groups:** Sorted lexicographically by resource key before IR emission
- **Enum order:** Preserve enum order as declared (do not sort). Changing order alters semantic meaning (UI dropdown order)
- Field/path ordering, whitespace must not affect output
- `$ref` resolved before IR

---

## 10. Unknown OpenAPI Top-Level Keys

- Ignored: `security`, `tags`, `x-*`, etc.
- **servers:** Explicitly ignored for UI compilation

---

## 11. Error Codes

Error codes are a stable public interface. Must not change between patch releases. Error categories must not be overloaded.

| Code | Stage | Use for |
| ---- | ----- | ------- |
| `OAS_UNSUPPORTED_SCHEMA_KEYWORD` | Subset | Unknown schema keyword; oneOf, anyOf, allOf; example, default, pattern |
| `OAS_INVALID_SCHEMA_SHAPE` | Subset | Hygiene: required⊆properties; array→items; object→properties; enum↔type; additionalProperties≠false; $ref+extra keys |
| `OAS_INVALID_OPERATION_STRUCTURE` | Subset | Empty paths; path has no supported ops; path-level parameters; missing request body; GET/DELETE with body; missing success response; zero ops globally |
| `OAS_INVALID_RESPONSE_STRUCTURE` | Subset | Multiple success; wrong content type; empty schema; root schema primitive |
| `OAS_INVALID_PARAMETER` | Subset | Path param not primitive; query param schema invalid (non-primitive, unsupported keyword) |
| `OAS_INVALID_REF` | Resolve | External ref; circular ref; invalid ref target |
| `OAS_AMBIGUOUS_RESOURCE_GROUPING` | ApiIR | Mixed tags; multiple tags per op; no CRUD ops |

---

## Compliance Tool

We use npm scripts for validation. No separate CLI binary for external clients.

```bash
npm run check:openapi -- path/to/spec.yaml
```

Output: **VALID** or **INVALID** with `code`, `message`, `jsonPointer` for each violation.

The check runs **parse → validateSubset → resolveRefs → buildApiIR** (all mandatory). Exit code: 0 for VALID, 1 for INVALID.

---

## Related Documentation

- [OpenAPI Compiler Pipeline](openapi-compiler.md) — pipeline stages, error taxonomy
- [RUS-v1 Feature Matrix](subset-v1-feature-matrix.md) — features used by golden/demo specs
