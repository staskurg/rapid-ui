## What this spec is for (very important)

This is **not** a demo spec.
This is a **compiler correctness spec**.

It should **always fail**, and it should fail **predictably, loudly, and consistently**.

You should snapshot:

* error codes
* error ordering
* error stages

If this spec ever *partially* compiles, that's a **regression**.

---

## What failures it intentionally triggers

### ❌ 1. Multiple tags on a single operation

```yaml
tags: [Orders, Billing]
```

Expected error:

* `OAS_MULTIPLE_TAGS` or `OAS_AMBIGUOUS_RESOURCE_GROUPING`
* Stage: OpenAPI → ApiIR

This validates:

* no tag guessing
* no tag sorting
* no implicit merging

---

### ❌ 2. Multiple success responses

```yaml
"200": ...
"201": ...
```

Expected error:

* `OAS_MULTIPLE_SUCCESS_RESPONSES`
* Stage: Subset Validation

This validates:

* canonical success response rule
* strictness of response selection

---

### ❌ 3. Multiple path parameters (composite key)

```yaml
/v1/orders/{orderId}/{lineId}
```

Expected error:

* `OAS_MULTIPLE_PATH_PARAMS`
* Stage: ApiIR construction

This validates:

* identifier rule (exactly one path param)
* no composite key support

---

### ❌ 4. Unsupported schema keyword (`oneOf`)

```yaml
oneOf:
  - ...
```

Expected error:

* `OAS_UNSUPPORTED_SCHEMA_KEYWORD`
* Stage: Subset Validation

This validates:

* strict subset enforcement
* no polymorphism leakage

---

## How you should use this spec

I strongly recommend:

1. **Unit test**:

   * Compile this spec
   * Assert compilation fails
   * Snapshot the full error list (codes + order)

2. **UX test**:

   * Upload in UI
   * Confirm:

     * no regeneration occurs
     * previous UISpec remains active
     * errors are visible and explicit

3. **Regression guard**:

   * If future work ever "fixes" this spec automatically → fail CI

---

## Golden Spec Set (Final)

You now have the complete, intentional trio:

| Spec       | Purpose                                             |
| ---------- | --------------------------------------------------- |
| **Spec A** | Happy-path CRUD (3.0, tags)                         |
| **Spec B** | Happy-path CRUD (3.1, path grouping + prefix strip) |
| **Spec C** | Deterministic failure surface                       |

This is exactly what a compiler-backed product should ship with.
