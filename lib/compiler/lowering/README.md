# Lowering (UiPlanIR → UISpec)

Maps normalized UiPlanIR + ApiIR to deterministic UISpec consumed by SchemaRenderer.

## Input

- **UiPlanIR**: Field paths, labels, ordering, readOnly per view (list, detail, create, edit)
- **ApiIR**: Schemas for type inference (responseSchema for list/detail, requestSchema for create/edit)

## Output

`Record<resourceSlug, UISpec>` — one UISpec per resource.

## Field Mapping

- **name**: Field path from UiPlanIR (supports dot paths e.g. `profile.firstName`)
- **label**: From FieldPlan or derived from path
- **type**: Inferred from JSON Schema — string, number, boolean, enum
- **required**: From schema `required` array
- **options**: From schema `enum` for enum type

## Array Fields

UISpec has no array type. Array-of-primitive fields (e.g. `tags: string[]`) are **excluded** from lowering for MVP. Future: add array support to UISpec and renderer.

## Nested Paths

- FormModal uses flat keys (`profile.firstName`). Use `flattenRecord` for initialValues, `unflattenRecord` on submit before adapter.create/update.
- DataTable/getCellValue supports dot paths for nested access.
