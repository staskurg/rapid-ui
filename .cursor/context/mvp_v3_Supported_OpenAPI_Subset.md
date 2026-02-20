# RapidUI — Supported OpenAPI Subset (MVP v3)

This document defines the **exact subset of OpenAPI** supported by RapidUI MVP v3.

RapidUI is a **deterministic OpenAPI → UI compiler**.
If a feature is not listed here, it is **not supported** and will result in a **compile-time error**.

The goal is **predictability, explainability, and trust**, not flexibility.

---

## 1. Supported OpenAPI Versions

* ✅ OpenAPI **3.0.x**
* ✅ OpenAPI **3.1.x**

Notes:

* OpenAPI 3.2 documents may be uploaded, but **3.2-only features are ignored or rejected**
* Schema semantics are interpreted conservatively and deterministically

---

## 2. Supported API Style

RapidUI supports **CRUD-style JSON APIs**.

### Supported HTTP methods

| Method | Supported | UI Semantics  |
| ------ | --------- | ------------- |
| GET    | ✅         | List / Detail |
| POST   | ✅         | Create        |
| PUT    | ✅         | Update        |
| PATCH  | ✅         | Update        |
| DELETE | ✅         | Delete        |

### Unsupported styles (compile error)

* RPC-style endpoints
* Side-effect-only actions
* Workflow APIs
* Streaming APIs

---

## 3. Paths & Routing

### Supported

* Static paths (e.g. `/users`, `/products/{id}`)
* Exactly **one path parameter** for detail/update/delete operations

Examples:

* ✅ `/users/{id}`
* ❌ `/orders/{orderId}/{lineId}`

### Unsupported

* Wildcards
* Regex paths
* Multiple path parameters
* Matrix parameters

---

## 4. Resource Grouping Rules

RapidUI groups endpoints into UI “resources” deterministically.

### Rule precedence

1. If **all operations have exactly one tag**, group by tag
2. Otherwise, group by path:

   * Strip prefixes: `api`, `v1`, `v2`, `v3`
   * Use first remaining path segment

### Unsupported

* Operations with multiple tags
* Ambiguous grouping

---

## 5. Request Bodies

### Supported

* `application/json`
* Exactly one schema per operation
* Required for:

  * POST
  * PUT
  * PATCH

### Unsupported (compile error)

* Missing request body on POST/PUT/PATCH
* Multipart/form-data
* File uploads
* Multiple content types

---

## 6. Responses

### Supported

* Exactly **one canonical success response**

  * Prefer `200`, otherwise `201`
* `application/json` only

### Unsupported (compile error)

* Multiple success responses (e.g. 200 + 201)
* Non-JSON responses
* Streaming responses
* `204 No Content` for CRUD operations

---

## 7. Parameters

### Supported

* `path` parameters (primitive only)
* `query` parameters (primitive only)

### Unsupported

* `header` parameters
* `cookie` parameters
* `querystring` objects (OpenAPI 3.2)
* Complex parameter schemas

---

## 8. Schema Support (JSON Schema Subset)

RapidUI supports a **strict subset** of JSON Schema.

### Supported keywords

* `type`
* `properties`
* `required`
* `enum`
* `items`
* `nullable`
* `format` (annotation only)
* `description` (annotation only)

### Supported types

* `object`
* `array`
* `string`
* `number`
* `integer`
* `boolean`

### Unsupported (compile error)

* `oneOf`
* `anyOf`
* `allOf`
* `not`
* discriminators
* conditional schemas

---

## 9. `$ref` Handling

### Supported

* Local `$ref` references **within the same document**

### Unsupported

* External `$ref` references
* Multi-file OpenAPI documents

---

## 10. Field Semantics

* Required fields → required UI inputs
* Nullable fields → nullable values (field still rendered)
* Fields are **never invented**
* Types are **never inferred**
* Annotations do not change structure

---

## 11. Descriptions & Annotations

### Supported (non-structural)

* `description`
* `example`
* `format`
* `pattern`

### Rules

* Used for labels, help text, hints
* **Never** affect:

  * layout
  * field inclusion
  * view structure

---

## 12. Error Handling Philosophy

* Unsupported features cause **hard compile errors**
* No partial UI generation
* No automatic fixing or guessing
* Previous UI remains active on failure

This is intentional.

---

## 13. Determinism Guarantee

RapidUI guarantees:

> **Same OpenAPI → same UI, every time**

This is enforced through:

* canonicalization
* strict subset enforcement
* deterministic compilation
* no runtime interpretation
* no user overrides

---

## 14. What’s Explicitly Out of Scope (MVP v3)

* Authentication / authorization
* Permissions / roles
* GitHub sync
* URL polling
* Workflows
* Webhooks
* Streaming UIs
* Custom layouts
* Manual overrides

---

## Summary

RapidUI treats OpenAPI as a **program**, not documentation.

If your API fits this subset:

* the UI will be predictable
* regeneration will be explainable
* diffs will be meaningful
* behavior will be boring (in the best way)

If not, RapidUI will fail loudly and tell you why.
