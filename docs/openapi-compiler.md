# OpenAPI Compiler

RapidUI compiles OpenAPI 3.0/3.1 specs into deterministic UISpecs. This document describes the pipeline stages, supported subset, and error codes.

## Pipeline Stages

```
OpenAPI string
   ↓  Parse (YAML/JSON)
Parsed document
   ↓  Validate subset
   ↓  Resolve $ref (local only)
   ↓  Canonicalize
Canonical OpenAPI + hash
   ↓  Build ApiIR
ApiIR (resources, operations, schemas)
   ↓  LLM plan (ApiIR → UiPlanIR)
   ↓  Normalize UiPlanIR
UiPlanIR
   ↓  Lower
UISpec (one per resource)
```

### Stage Details

| Stage | Purpose | Failure → |
| ----- | ------- | --------- |
| **Parse** | Parse YAML or JSON into OpenAPI document | `OAS_PARSE_ERROR` |
| **Validate** | Reject unsupported constructs (oneOf, multiple responses, etc.) | `OAS_*` errors |
| **Resolve** | Inline local `$ref`; reject external refs | `OAS_EXTERNAL_REF`, `OAS_CIRCULAR_REF` |
| **Canonicalize** | Stable key/array ordering; produce hash | — |
| **ApiIR** | Convert to semantic IR (resources, operations) | `IR_INVALID`, `OAS_AMBIGUOUS_RESOURCE_GROUPING` |
| **UiPlanIR** | LLM infers labels, field order, readOnly | `UIPLAN_INVALID`, `UIPLAN_LLM_UNAVAILABLE` |
| **Lower** | UiPlanIR + ApiIR → UISpec | `UISPEC_INVALID` |

## Supported OpenAPI Subset

RapidUI supports a **strict subset**. Unsupported features cause **compile errors**.

### Versions

- ✅ OpenAPI 3.0.x
- ✅ OpenAPI 3.1.x
- OpenAPI 3.2: 3.2-only features ignored or rejected

### API Style

- **CRUD only**: GET (list/detail), POST (create), PUT/PATCH (update), DELETE
- **Unsupported**: RPC-style, side-effect-only, workflows, streaming

### Paths

- ✅ Static paths: `/users`, `/products`
- ✅ One path parameter: `/users/{id}`, `/orders/{orderId}`
- ❌ Multiple path params: `/orders/{orderId}/{lineId}`

### Request Bodies

- **Required** for POST, PUT, PATCH
- Content type: `application/json` only
- ❌ Missing body, multipart, file uploads

### Responses

- Exactly **one** success response (200 or 201)
- `application/json` only
- ❌ Multiple success responses, non-JSON, streaming

### Resource Grouping

1. If **all** operations have exactly one tag → group by tag
2. Else → group by path (strip `api`, `v1`, `v2`, `v3`; use first segment)
3. ❌ Operations with multiple tags; ambiguous grouping

### Schemas

- **Supported**: `type`, `properties`, `required`, `enum`, `items`, `nullable`, `format`, `description`
- **Types**: object, array, string, number, integer, boolean
- **❌ Unsupported**: `oneOf`, `anyOf`, `allOf`, `not`, discriminators

### $ref

- ✅ Local refs within same document
- ❌ External refs, multi-file specs

## Error Taxonomy

Errors include `code`, `stage`, `message`, and optional `jsonPointer`.

### Parse

| Code | Meaning |
| ---- | ------- |
| `OAS_PARSE_ERROR` | Invalid YAML/JSON or malformed OpenAPI |

### Subset / Validate

| Code | Meaning |
| ---- | ------- |
| `OAS_UNSUPPORTED_SCHEMA_KEYWORD` | oneOf, anyOf, allOf, etc. |
| `OAS_MULTIPLE_SUCCESS_RESPONSES` | More than one success response |
| `OAS_MULTIPLE_TAGS` | Operation has multiple tags |
| `OAS_MISSING_REQUEST_BODY` | POST/PUT/PATCH without body |
| `OAS_MULTIPLE_PATH_PARAMS` | More than one path parameter |
| `OAS_EXTERNAL_REF` | External $ref |
| `OAS_CIRCULAR_REF` | Circular $ref |
| `OAS_AMBIGUOUS_RESOURCE_GROUPING` | Cannot uniquely group operations |

### ApiIR

| Code | Meaning |
| ---- | ------- |
| `IR_INVALID` | ApiIR build failed |

### UiPlan

| Code | Meaning |
| ---- | ------- |
| `UIPLAN_INVALID` | LLM output failed Zod validation |
| `UIPLAN_LLM_UNAVAILABLE` | LLM call failed (timeout, rate limit, etc.) |

### Lowering

| Code | Meaning |
| ---- | ------- |
| `UISPEC_INVALID` | Lowering produced invalid UISpec |

## Demo Specs

Built-in OpenAPI files for quick testing:

| ID | Description |
| --- | ----------- |
| `golden_openapi_users_tagged_3_0` | Golden Users (tag-based grouping) |
| `golden_openapi_products_path_3_1` | Golden Products (path-based grouping) |
| `demo_users_tasks_v1` | Demo v1 (Users only) |
| `demo_users_tasks_v2` | Demo v2 (Users + Tasks) |
| `demo_users_tasks_v3` | Demo v3 (updated fields) |

Download: `GET /api/demo-specs/[id]` → YAML file.

## Determinism Guarantee

> **Same OpenAPI → same UISpec → same UI, every time**

Enforced by:
- Canonicalization (stable key/array order)
- Strict subset (no interpretation)
- Deterministic compilation
- LLM with temperature 0
- No runtime overrides
