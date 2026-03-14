# UI Capability Analysis — SchemaRenderer vs Blueprint

## Summary

The capability-driven lowering produces correct UISpecs (all 12 capability-specs match the blueprint). However, **SchemaRenderer does not fully respect capabilities** when rendering. Several scenarios show incorrect or missing UI.

---

## Current Behavior vs Expected (Blueprint)

| Scenario | Capabilities | Expected UI | Actual UI | Status |
|----------|--------------|------------|-----------|--------|
| **create-only** | form only | Form + Create button | Table ("No records") + Form + Create | ❌ Table shown |
| **create-update** | form only | Form + Create/Edit | Table ("No records") + Form + Create/Edit | ❌ Table shown |
| **detail-only** | detail only | Detail view | Table ("No records") | ❌ No detail view |
| **detail-update** | detail + form | Detail + Form | Table ("No records") + Form | ❌ No detail view |
| **list-create** | table + form + filters | Table + Filters + Form | Table + Filters + Form | ✓ |
| **list-detail-create** | table + detail + form + filters | Table + Detail + Form + Filters | Table + Form + Filters | ⚠️ No detail view |
| **list-detail-create-update** | full CRUD minus delete | Table + Detail + Form + Filters | Table + Form + Filters | ⚠️ No detail view |
| **list-detail-delete** | table + detail + filters (no form) | Table + Detail + Filters | Table + Filters | ⚠️ No detail view |
| **list-detail-only** | table + detail + filters | Table + Detail + Filters | Table + Filters | ⚠️ No detail view |
| **list-detail-update** | table + detail + form + filters | Table + Detail + Form + Filters | Table + Form + Filters | ⚠️ No detail view |
| **list-only** | table + filters | Table + Filters | Table + Filters | ✓ |
| **update-only** | form only | Form (edit) | Table ("No records") + Form | ❌ Table shown |

---

## Root Causes

### 1. Table Always Shown (Missing `list` Capability Check)

**Location:** `components/renderer/SchemaRenderer.tsx` (lines 326–337)

SchemaRenderer always renders `DataTable` when not loading. It never checks whether the resource has `list` capability.

```tsx
// Current: always shows DataTable
) : (
  <DataTable
    data={filteredData}
    spec={spec}
    ...
  />
)
```

**Why:** `adapter.capabilities` is `AdapterCapabilities` (`create`, `read`, `update`, `delete`). There is no `list` — `read` is `list || detail`. The renderer cannot distinguish list vs detail.

**Fix:** Pass full `Capabilities` (list, detail, create, update, delete) to SchemaRenderer and only render DataTable when `capabilities.list` is true.

---

### 2. Detail View Completely Missing

**Location:** No component renders `spec.detail`

The UISpec has `detail?: { fields: string[] }` when `capabilities.detail` is true. SchemaRenderer never uses it. There is no:

- Detail panel / modal when clicking a row (list-detail)
- Standalone detail view (detail-only)

**Fix:** Add a detail view component that:

- For **list-detail**: Renders when user selects a row (e.g. side panel or expandable row)
- For **detail-only**: Needs a way to select a record (e.g. ID input, or first record if any)

---

### 3. Capabilities Not Passed to SchemaRenderer

**Location:** `components/compiler/CompiledUIContent.tsx` (line 107)

```tsx
<SchemaRenderer spec={spec} adapter={adapter} />
```

`capabilities` (full `Capabilities` from apiIr) is available in CompiledUIContent but not passed to SchemaRenderer. The renderer only gets `adapter.capabilities` (AdapterCapabilities), which lacks `list` and `detail`.

**Fix:** Pass `capabilities` to SchemaRenderer:

```tsx
<SchemaRenderer spec={spec} adapter={adapter} capabilities={capabilities} />
```

---

### 4. `list()` Always Called on Mount

**Location:** `components/renderer/SchemaRenderer.tsx` (lines 51–83)

SchemaRenderer always calls `adapter.list()` on mount. For create-only, detail-only, update-only, the list is empty (custom specs start with `[]`). The table still renders with "No records".

**Fix:** When `capabilities.list` is false, either:

- Skip the `list()` call (no network request), or
- Call it but do not render the table (current behavior would be wrong until table is hidden)

Hiding the table when `list` is false is the primary fix; optionally skip `list()` when not needed.

---

## What Works Correctly

1. **Create button** — Only shown when `capabilities.create` ✓  
2. **Edit button** — Only shown when `capabilities.update` ✓  
3. **Delete** — Only shown when `capabilities.delete` ✓  
4. **Filters** — Only shown when `spec.filters` has items (filters only exist when list) ✓  
5. **FormModal** — Only shown when create/update ✓  
6. **DataTable** — Handles `spec.table?.columns ?? []` (no crash when table missing) ✓  
7. **FormModal** — Uses `spec.form?.fields ?? []` (no crash when form missing) ✓  

---

## Recommended Fix Order

1. **Pass `capabilities` to SchemaRenderer** — CompiledUIContent already has it; add the prop.
2. **Hide DataTable when `!capabilities.list`** — Use `spec.table` as a secondary guard (when capabilities not passed, fall back to `spec.table` for backward compatibility).
3. **Add DetailView component** — Render `spec.detail?.fields` for the selected record.
4. **Wire detail into list-detail flow** — On row click (when detail capability), show detail view instead of or in addition to edit modal.
5. **Handle detail-only UX** — e.g. ID input to fetch and display a single record, or "View record" with ID field.

---

## Blueprint Alignment

From the blueprint (Phase 1.4):

> **Update** SchemaRenderer: handle missing sections; derive mode from capabilities at render time.

> **Renderer:** Handle missing sections gracefully; derive mode from capabilities at render time (do not store mode).

The current implementation does not fully derive mode from capabilities: it always shows the table and never shows the detail view.
