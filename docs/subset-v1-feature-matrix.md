# RUS-v1 Feature Matrix

Feature usage across golden and demo specs. Serves as **RUS-v1 = union of these** and as a regression checklist.

---

## Spec Overview

| Spec | OpenAPI | Grouping | Valid |
| ---- | ------- | --------- | ----- |
| `golden_openapi_users_tagged_3_0` | 3.0.3 | Tag (Users) | ✅ |
| `golden_openapi_products_path_3_1` | 3.1.0 | Path (Products) | ✅ |
| `golden_openapi_invalid_expected_failure` | 3.1.0 | — | ❌ (intentionally invalid) |
| `demo_users_tasks_v1` | 3.0.3 | Tag (Users) | ✅ |
| `demo_users_tasks_v2` | 3.0.3 | Tag (Users, Tasks) | ✅ |
| `demo_users_tasks_v3` | 3.0.3 | Tag (Users, Tasks) | ✅ |

---

## Schema Keywords Used

| Keyword | golden_users | golden_products | demo_v1 | demo_v2 | demo_v3 |
| ------- | ------------- | ---------------- | ------- | ------- | ------- |
| `type` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `properties` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `required` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `enum` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `items` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$ref` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `format` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `description` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `additionalProperties: false` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `minimum` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `maximum` | ✅ | — | ✅ | ✅ | ✅ |
| `nullable` (OAS 3.1 style) | — | ✅ | — | — | — |

---

## HTTP Methods

| Method | golden_users | golden_products | demo_v1 | demo_v2 | demo_v3 |
| ------ | ------------- | ---------------- | ------- | ------- | ------- |
| GET | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST | ✅ | ✅ | ✅ | ✅ | ✅ |
| PUT | ✅ | — | ✅ | ✅ | ✅ |
| PATCH | ✅ | ✅ | ✅ | ✅ | ✅ |
| DELETE | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Path Structure

| Feature | golden_users | golden_products | demo_v1 | demo_v2 | demo_v3 |
| ------- | ------------- | ---------------- | ------- | ------- | ------- |
| Static path | `/users` | — | `/users` | `/users`, `/tasks` | `/users`, `/tasks` |
| Path param (1 per path) | `/users/{userId}` | `/api/v1/products/{sku}` | `/users/{userId}` | `/users/{userId}`, `/tasks/{taskId}` | `/users/{userId}`, `/tasks/{taskId}` |
| Path prefix strip | — | `/api/v1/products` | — | — | — |

---

## Parameters

| Feature | golden_users | golden_products | demo_v1 | demo_v2 | demo_v3 |
| ------- | ------------- | ---------------- | ------- | ------- | ------- |
| Path param (string) | `/users/{userId}` | `/api/v1/products/{sku}` | `/users/{userId}` | `/users/{userId}`, `/tasks/{taskId}` | `/users/{userId}`, `/tasks/{taskId}` |
| Query param (integer) | `limit` | — | `limit` | `limit` | `limit` |
| Query param (string) | `cursor` | `q` | — | — | — |
| Query param (string enum) | — | `status` | — | — | — |

---

## Response Codes

| Code | golden_users | golden_products | demo_v1 | demo_v2 | demo_v3 |
| ---- | ------------- | ---------------- | ------- | ------- | ------- |
| 200 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 201 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Schema Types

| Type | golden_users | golden_products | demo_v1 | demo_v2 | demo_v3 |
| ---- | ------------- | ---------------- | ------- | ------- | ------- |
| object | ✅ | ✅ | ✅ | ✅ | ✅ |
| array | ✅ | ✅ | ✅ | ✅ | ✅ |
| string | ✅ | ✅ | ✅ | ✅ | ✅ |
| integer | ✅ | ✅ | ✅ | ✅ | ✅ |
| number | ✅ | ✅ | — | — | — |
| boolean | ✅ | ✅ | ✅ | ✅ | ✅ |
| `type: ["string","null"]` (OAS 3.1 nullable) | — | ✅ | — | — | — |
| Array of object | ✅ | ✅ | ✅ | ✅ | ✅ |
| Array of primitive (string) | — | ✅ | — | — | ✅ |

---

## Invalid Spec: Expected Failures

`golden_openapi_invalid_expected_failure` intentionally violates:

| Violation | Description |
| --------- | ----------- |
| Multiple tags | `tags: [Orders, Billing]` |
| Multiple success responses | Both 200 and 201 |
| Multiple path params | `/orders/{orderId}/{lineId}` |
| Unsupported schema keyword | `oneOf` in response schema |
| Missing request body | POST without requestBody |

---

## Regression Checklist

When adding or changing RUS-v1 rules, verify:

- [ ] `golden_openapi_users_tagged_3_0.yaml` → VALID
- [ ] `golden_openapi_products_path_3_1.yaml` → VALID
- [ ] `golden_openapi_invalid_expected_failure.yaml` → INVALID (expected codes)
- [ ] `demo_users_tasks_v1.yaml` → VALID
- [ ] `demo_users_tasks_v2.yaml` → VALID
- [ ] `demo_users_tasks_v3.yaml` → VALID
