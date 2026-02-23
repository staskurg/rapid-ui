# FormModal Nested Schema

This document describes how FormModal handles nested field paths (e.g. `profile.firstName`) and aligns with React Hook Form's data structure.

## Problem

The UISpec uses flat dot-path names for fields (e.g. `profile.firstName`, `profile.lastName`). React Hook Form, when using `register("profile.firstName")`, stores values in a **nested** structure:

```js
// What RHF stores
{ profile: { firstName: "Alice", lastName: "Smith" } }
```

A flat Zod schema expects `data["profile.firstName"]`, which is `undefined` when RHF provides nested data. This caused validation to fail before submit.

## Solution

Use a **nested Zod schema** that matches RHF's structure. All form-related logic (schema, defaults, errors) uses nested structure.

## Implementation

### 1. `buildNestedSchema(spec)` (lib/utils/formSchema.ts)

Converts dotted field names into a nested Zod schema:

```ts
// spec.form.fields = ["email", "profile.firstName", "profile.lastName"]
// Produces:
z.object({
  email: z.string(),
  profile: z.object({
    firstName: z.string(),
    lastName: z.string()
  })
})
```

- Flat fields (`email`) → top-level keys
- Nested fields (`profile.firstName`) → nested objects
- Supports arbitrary depth (`address.billing.street`)

### 2. `buildNestedDefaults(spec)`

Builds nested default values for optional boolean fields:

```ts
// profile.newsletter (optional boolean)
// Produces: { profile: { newsletter: false } }
```

### 3. `getErrorByPath(errors, path)`

Resolves error messages for nested paths:

```ts
getErrorByPath(form.formState.errors, "profile.firstName")
// → errors?.profile?.firstName?.message
```

### 4. `mergeNested(a, b)`

Deep merge for combining defaults with initialValues. Ensures optional booleans from defaults are preserved when the API omits them in edit mode.

### 5. FormModal Changes

- Replace flat schema with `buildNestedSchema(spec)`
- Use `buildNestedDefaults(spec)` for optional boolean defaults
- Use `mergeNested(getDefaultValues, initialValues)` when resetting with initialValues
- Use `getErrorByPath(form.formState.errors, fieldName)` for error display
- `initialValues` and `onSubmit` data are both nested

### 6. SchemaRenderer Changes

- **Edit modal**: Pass `editRecord` directly (no `flattenRecord`). API returns nested data.
- **handleCreate / handleUpdate**: Pass `record` directly (no `unflattenRecord`). Form submits nested data; adapter expects nested.

## Data Flow

| Stage | Data shape | Example |
|-------|------------|---------|
| API response | Nested | `{ profile: { firstName: "Alice" } }` |
| UISpec fields | Flat names (dot paths) | `"profile.firstName"` |
| RHF with register("profile.firstName") | Nested | `{ profile: { firstName: "Alice" } }` |
| Zod schema | Nested | `z.object({ profile: z.object({ firstName: z.string() }) })` |
| Submit payload | Nested | Adapter receives nested |

## flattenRecord / unflattenRecord

These utilities exist in `lib/utils/` but are **no longer used** in the form flow. They remain available for other use cases (e.g. a future adapter that expects flat payloads).

## Edge Cases

- **Flat-only spec**: Nested schema still works: `z.object({ email: z.string() })`
- **Optional booleans**: `buildNestedDefaults` sets nested paths (e.g. `profile.newsletter: false`)
- **Deep nesting**: Schema builder handles arbitrary depth via recursive `toZodObject`
- **Empty nested object**: Create mode with no initialValues; schema validates required nested fields when missing

## Tests

The SchemaRenderer test mocks FormModal and uses flat data (`{ name: "..." }`). This works because flat records are valid nested records (top-level keys). No test changes required.
