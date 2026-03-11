# Golden Archetypes — API Resource Classification

This document describes the 22 golden archetypes used by the archetype extraction tool to classify API resources. Each archetype represents a distinct pattern that stresses different parts of the compiler and renderer. Golden candidates are selected per archetype for regression testing.

---

## 1. simple_create

**Rule:** `fields ≤ 4`, `depth = 0`, `operationPattern = create_only`

**Rationale:** Minimal create-only resource. Tests basic POST body handling with flat schema.

**Example characteristics:** 1–4 primitive fields, no nested objects, no list/detail operations.

---

## 2. simple_list

**Rule:** `fields ≤ 4`, `depth = 0`, `operationPattern = list_only`

**Rationale:** Minimal list-only resource. Tests basic GET collection handling.

**Example characteristics:** 1–4 fields, flat schema, list operation only.

---

## 3. list_detail

**Rule:** `fields ≤ 4`, `depth = 0`, `operationPattern = list_detail`

**Rationale:** List + detail without create. Common read-only API pattern.

**Example characteristics:** Small schema, list and detail operations, no create/update/delete.

---

## 4. list_create

**Rule:** `fields ≤ 4`, `depth = 0`, `operationPattern = list_create`

**Rationale:** List + create without detail. Tests collection + creation flow.

**Example characteristics:** Flat schema, list and create operations.

---

## 5. full_crud

**Rule:** `fields ≤ 6`, `depth = 0`, `operationPattern = crud`

**Rationale:** Complete CRUD with flat schema. Stresses all five operation kinds.

**Example characteristics:** Up to 6 fields, list, detail, create, update, delete.

---

## 6. enum_heavy

**Rule:** `enumCount ≥ 2`

**Rationale:** Multiple enum fields stress dropdown/select rendering and validation.

**Example characteristics:** Two or more fields with enum constraints.

---

## 7. array_of_objects

**Rule:** `arrayOfObjectsCount ≥ 1`

**Rationale:** Array-of-objects stresses the renderer; array-of-primitives does not.

**Example characteristics:** At least one property with `type: array` and `items.type: object`.

---

## 8. nested_depth_1

**Rule:** `depth = 1`

**Rationale:** One level of object nesting. Tests nested form rendering.

**Example characteristics:** Object with at least one nested object property.

---

## 9. nested_depth_2

**Rule:** `depth = 2`

**Rationale:** Two levels of nesting. Stresses deep form layout.

**Example characteristics:** Object → object → object path.

---

## 10. map_schema

**Rule:** `mapCount ≥ 1`

**Rationale:** `additionalProperties` (map/dictionary) handling.

**Example characteristics:** Property with `additionalProperties: true` or schema.

---

## 11. multi_resource

**Rule:** `resourceCount ≥ 3` (spec-level)

**Rationale:** Spec with multiple resources. Tests navigation and resource switching.

**Example characteristics:** Three or more resources in the same API.

---

## 12. large_resource

**Rule:** `fieldCount ≥ 15`

**Rationale:** Many fields stress form layout and validation.

**Example characteristics:** 15+ properties on the resource schema.

---

## 13. optional_heavy

**Rule:** `requiredCount ≤ 2`, `optionalCount ≥ 5`

**Rationale:** Mostly optional fields. Tests optional-field handling and UI density.

**Example characteristics:** Few required, many optional properties.

---

## 14. array_heavy

**Rule:** `arrayOfObjectsCount ≥ 2`

**Rationale:** Multiple array-of-objects fields. Stresses repeatable section rendering.

**Example characteristics:** Two or more array-of-objects properties.

---

## 15. mixed_operations

**Rule:** Spec has ≥1 resource with `create_only` AND ≥1 with `list_only` AND ≥1 with `detail_only`

**Rationale:** Spec mixes different operation patterns across resources.

**Example characteristics:** Some resources create-only, others list-only, others detail-only.

---

## 16. deep_schema

**Rule:** `depth ≥ 3`

**Rationale:** Deep nesting stresses recursive form rendering.

**Example characteristics:** Three or more levels of object nesting.

---

## 17. many_enum_values

**Rule:** `maxEnumValues ≥ 10`

**Rationale:** Large enum (10+ options) stresses select/dropdown UX.

**Example characteristics:** At least one enum with 10+ values.

---

## 18. nullable_fields

**Rule:** `nullableCount ≥ 2`

**Rationale:** Multiple nullable fields. Tests null handling in forms.

**Example characteristics:** Two or more properties with `nullable: true` or `type: ["X","null"]`.

---

## 19. large_api

**Rule:** `resourceCount ≥ 10` (spec-level)

**Rationale:** Large API with many resources. Stresses navigation and scale.

**Example characteristics:** 10+ resources in the spec.

---

## 20. mixed_schema_types

**Rule:** `enumCount ≥ 1` AND `arrayOfObjectsCount ≥ 1` AND `nestedObjectCount ≥ 1`

**Rationale:** Resource combines enums, arrays of objects, and nested objects.

**Example characteristics:** At least one of each: enum, array-of-objects, nested object.

---

## 21. array_root_list

**Rule:** List op response shape = `array_root`

**Rationale:** List returns array at root (`[{...}, {...}]`). Common pattern.

**Example characteristics:** `GET /items` → `[{ id, name }, ...]`.

---

## 22. wrapped_list_response

**Rule:** List op response shape = `object_wrapped`

**Rationale:** List returns object with array property (`{ data: [{...}] }`).

**Example characteristics:** `GET /users` → `{ data: [{ id, name }] }`.

---

## See also

- `scripts/extract-archetypes.ts` — extraction script
- `scripts/corpus-data/archetype-extractor.ts` — classification logic
- `scripts/corpus-data/reports/golden-candidates.md` — selected candidates per archetype
