Can I use RapidUI for LLM input and website OpenAPI Spec validation?

---

# Short answer (direct)

* ❌ **Do NOT** send the raw checklist + spec to an LLM and ask “is this supported?”
* ✅ **DO** use the LLM as a **structured validator/explainer on top of a deterministic preflight** you control.

The checklist you have is **human-friendly**.
For an LLM, you need a **machine-verifiable contract + constrained explanation role**.

Below is the **correct architecture**, then the **LLM-friendly checklist**, and finally the **exact prompt + flow** you should use.

---

# The correct architecture (non-negotiable)

### ✅ Correct flow

```
User uploads OpenAPI
   ↓
Deterministic Preflight Validator (your code)
   - subset checks
   - structural rules
   - hard pass / fail
   ↓
IF FAIL:
   LLM = explanation layer ONLY
   - explain failures
   - map to checklist items
   - suggest fixes
IF PASS:
   LLM optional:
   - confirm compatibility
   - summarize what UI will be generated
```

### ❌ Incorrect flow (do not do this)

```
OpenAPI + checklist → LLM → "yes/no"
```

Why this is wrong:

* LLMs are probabilistic
* You lose determinism
* You can’t guarantee consistency with compiler behavior
* You’ll get false positives (“looks fine!” → compiler fails)

👉 **The compiler must remain the source of truth.**
The LLM may only *explain* compiler decisions.

---

# What you actually need: an LLM-friendly checklist

Instead of prose, you need a **declarative rule list** that mirrors your compiler constitution.

This is what you send to the LLM **after** your validator runs.

---

## LLM-Friendly Supported OpenAPI Rules (Canonical)

Use this exact structure.

```json
{
  "rapiduiv3_supported_rules": [
    {
      "id": "OAS_VERSION",
      "description": "OpenAPI version must be 3.0.x or 3.1.x",
      "severity": "error"
    },
    {
      "id": "CRUD_ONLY",
      "description": "Only CRUD-style endpoints are supported (GET, POST, PUT, PATCH, DELETE)",
      "severity": "error"
    },
    {
      "id": "SINGLE_PATH_PARAM",
      "description": "Detail/update/delete endpoints must have exactly one path parameter",
      "severity": "error"
    },
    {
      "id": "REQUEST_BODY_REQUIRED",
      "description": "POST, PUT, PATCH must define an application/json request body",
      "severity": "error"
    },
    {
      "id": "SINGLE_SUCCESS_RESPONSE",
      "description": "Operations must have exactly one success response (200 or 201)",
      "severity": "error"
    },
    {
      "id": "JSON_ONLY",
      "description": "Only application/json content types are supported",
      "severity": "error"
    },
    {
      "id": "NO_POLYMORPHISM",
      "description": "Schemas must not use oneOf, anyOf, allOf, not, or discriminators",
      "severity": "error"
    },
    {
      "id": "LOCAL_REFS_ONLY",
      "description": "All $ref references must be local to the same document",
      "severity": "error"
    },
    {
      "id": "TAGS_OR_PATH_GROUPING",
      "description": "Operations must either have exactly one tag each or be groupable by path",
      "severity": "error"
    },
    {
      "id": "PRIMITIVE_PARAMS_ONLY",
      "description": "Only primitive path and query parameters are supported",
      "severity": "error"
    }
  ]
}
```

This is **not** validation logic.
It’s a **shared vocabulary** between:

* your compiler
* your UI
* the LLM explainer

---

# The correct LLM usage pattern

## Step 1: Your deterministic validator runs

Your validator outputs something like:

```json
{
  "supported": false,
  "errors": [
    {
      "ruleId": "NO_POLYMORPHISM",
      "location": "/components/schemas/OrderLine",
      "details": "Schema uses oneOf"
    },
    {
      "ruleId": "SINGLE_PATH_PARAM",
      "location": "/paths/~1orders~1{orderId}~1{lineId}",
      "details": "Multiple path parameters found"
    }
  ]
}
```

This is the **truth**.

---

## Step 2: LLM = explanation & guidance only

### System Prompt (fixed)

```text
You are RapidUI’s OpenAPI compatibility explainer.

You do NOT decide whether a spec is supported.
That decision has already been made by a deterministic validator.

Your job is to:
- Explain validation failures clearly
- Map them to supported rules
- Suggest concrete fixes
- Do not invent new rules
- Do not contradict the validator

You must only use the provided rules and validation results.
```

---

### User Prompt (templated)

```text
The following OpenAPI specification failed RapidUI compatibility checks.

SUPPORTED RULES:
<JSON_RULE_LIST>

VALIDATION RESULT:
<VALIDATION_RESULT_JSON>

TASK:
1. For each error:
   - Explain what the rule means in simple terms
   - Explain why this spec violates it
   - Suggest how to fix it
2. Provide a short summary:
   - "What to change to make this spec compatible"

Do not say the spec is compatible.
Do not invent missing errors.
Do not propose unsupported features.
```

---

## Step 3: LLM Output (example)

```text
Your OpenAPI spec is not currently supported by RapidUI.

Issue 1: Polymorphic schemas are not supported
- Rule: NO_POLYMORPHISM
- Location: components/schemas/OrderLine
- Reason: The schema uses oneOf, which introduces multiple possible shapes.
- How to fix: Replace oneOf with a single object schema or split this endpoint into separate resources.

Issue 2: Multiple path parameters detected
- Rule: SINGLE_PATH_PARAM
- Location: /orders/{orderId}/{lineId}
- Reason: RapidUI supports only one identifier per resource.
- How to fix: Introduce a separate resource (e.g. /order-lines/{lineId}) or flatten the model.

Once these issues are resolved, re-upload your spec to continue.
```

This feels helpful **without weakening determinism**.

---

# Why this approach is correct

| Concern                   | This approach |
| ------------------------- | ------------- |
| Determinism               | ✅ Preserved   |
| LLM hallucinations        | ❌ Prevented   |
| Consistency with compiler | ✅ Guaranteed  |
| User trust                | ✅ High        |
| Debuggability             | ✅ Excellent   |

---

# Final recommendation (very important)

> **Never ask the LLM “is this spec supported?”**

Instead:

* **You decide**
* **The LLM explains**

That’s the compiler mindset.
