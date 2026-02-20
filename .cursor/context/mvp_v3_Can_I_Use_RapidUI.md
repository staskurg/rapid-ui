# Can I Use RapidUI? ✅

**Quick Compatibility Checklist (MVP v3)**

Answer **YES** to all required items below and RapidUI will work as expected.

If you hit a **NO**, RapidUI will fail fast and tell you why.

---

## ✅ OpenAPI Basics

* [ ] I have an **OpenAPI spec** (not Postman, not prose)
* [ ] The spec is **OpenAPI 3.0.x or 3.1.x**
* [ ] The spec is **valid YAML or JSON**

---

## ✅ API Style (Required)

* [ ] My API is **CRUD-style**, not RPC or workflow-based
* [ ] I use standard HTTP methods:

  * `GET` for read
  * `POST` for create
  * `PUT` / `PATCH` for update
  * `DELETE` for delete
* [ ] I’m not relying on side-effect-only endpoints (e.g. “/runJob”, “/approve”)

---

## ✅ Paths & Resources

* [ ] List endpoints look like: `/resources`
* [ ] Detail endpoints look like: `/resources/{id}`
* [ ] Detail/update/delete endpoints have **exactly one path parameter**
* [ ] I’m not using wildcard or regex paths

---

## ✅ Tags & Grouping

* [ ] **Either**:

  * All operations have **exactly one tag**, **or**
  * I’m okay with grouping by path (e.g. `/api/v1/users` → `users`)
* [ ] No operation has multiple tags

---

## ✅ Request Bodies

* [ ] `POST`, `PUT`, and `PATCH` operations all have a request body
* [ ] Request bodies use **`application/json` only**
* [ ] One schema per request body
* [ ] No file uploads or multipart forms

---

## ✅ Responses

* [ ] Each operation has **exactly one success response**

  * Usually `200` or `201`
* [ ] Success responses use **`application/json`**
* [ ] I’m not relying on `204 No Content` for CRUD flows
* [ ] I’m not using streaming responses

---

## ✅ Parameters

* [ ] I only use:

  * `path` parameters (primitives)
  * `query` parameters (primitives)
* [ ] I’m not using:

  * header parameters
  * cookie parameters
  * complex query objects

---

## ✅ Schemas (Very Important)

* [ ] My schemas use only:

  * `type`
  * `properties`
  * `required`
  * `enum`
  * `items`
  * `nullable`
* [ ] I’m **not** using:

  * `oneOf`
  * `anyOf`
  * `allOf`
  * discriminators
  * conditional schemas
* [ ] All types are explicit (no inferred types)

---

## ✅ `$ref` Usage

* [ ] All `$ref`s are **local** (same file)
* [ ] I’m not referencing external files or URLs

---

## ❌ Things RapidUI Does *Not* Do (MVP v3)

Make sure you’re **not** expecting any of these:

* ⛔ Auth or permission-aware UIs
* ⛔ Role-based visibility
* ⛔ GitHub sync or URL polling
* ⛔ Webhooks or workflows
* ⛔ Streaming or real-time UIs
* ⛔ Custom layouts or manual overrides
* ⛔ Partial regeneration
