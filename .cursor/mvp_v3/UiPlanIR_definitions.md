Here are **matching** UiPlanIR definitions in both **JSON Schema (2020-12)** and **Zod**, aligned exactly with the prompt contract:

* `UiPlanIR` is an object with `resources: ResourcePlan[]`
* Each `ResourcePlan` has:

  * `name: string`
  * `views: { list?, detail?, create?, edit? }`
* Each view is `{ fields: FieldPlan[] }`
* Each `FieldPlan` is:

  * `path: string` (required)
  * `label?: string`
  * `readOnly?: boolean`
  * `order?: number`
* No `null`s allowed
* Unknown keys are rejected (`additionalProperties: false` / `.strict()`)

---

## JSON Schema (2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rapiduidev/schemas/uiplanir.schema.json",
  "title": "UiPlanIR",
  "type": "object",
  "additionalProperties": false,
  "required": ["resources"],
  "properties": {
    "resources": {
      "type": "array",
      "minItems": 0,
      "items": { "$ref": "#/$defs/ResourcePlan" }
    }
  },
  "$defs": {
    "ResourcePlan": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "views"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "views": { "$ref": "#/$defs/ViewsPlan" }
      }
    },
    "ViewsPlan": {
      "type": "object",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "list": { "$ref": "#/$defs/ViewPlan" },
        "detail": { "$ref": "#/$defs/ViewPlan" },
        "create": { "$ref": "#/$defs/ViewPlan" },
        "edit": { "$ref": "#/$defs/ViewPlan" }
      }
    },
    "ViewPlan": {
      "type": "object",
      "additionalProperties": false,
      "required": ["fields"],
      "properties": {
        "fields": {
          "type": "array",
          "minItems": 0,
          "items": { "$ref": "#/$defs/FieldPlan" }
        }
      }
    },
    "FieldPlan": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path"],
      "properties": {
        "path": { "type": "string", "minLength": 1 },
        "label": { "type": "string", "minLength": 1 },
        "readOnly": { "type": "boolean" },
        "order": { "type": "number" }
      }
    }
  }
}
```

Notes:

* `order` is `number` (not integer) to match the prompt “number”; if you want integers only, change to `"type": "integer"`.
* `label` minLength=1 prevents empty strings.

---

## Zod Schema (TypeScript)

```ts
import { z } from "zod";

export const FieldPlanSchema = z
  .object({
    path: z.string().min(1),
    label: z.string().min(1).optional(),
    readOnly: z.boolean().optional(),
    order: z.number().optional(), // use z.number().int() if you want integer-only
  })
  .strict();

export const ViewPlanSchema = z
  .object({
    fields: z.array(FieldPlanSchema),
  })
  .strict();

export const ViewsPlanSchema = z
  .object({
    list: ViewPlanSchema.optional(),
    detail: ViewPlanSchema.optional(),
    create: ViewPlanSchema.optional(),
    edit: ViewPlanSchema.optional(),
  })
  .strict();

export const ResourcePlanSchema = z
  .object({
    name: z.string().min(1),
    views: ViewsPlanSchema,
  })
  .strict();

export const UiPlanIRSchema = z
  .object({
    resources: z.array(ResourcePlanSchema),
  })
  .strict();

export type UiPlanIR = z.infer<typeof UiPlanIRSchema>;
export type ResourcePlan = z.infer<typeof ResourcePlanSchema>;
export type ViewPlan = z.infer<typeof ViewPlanSchema>;
export type FieldPlan = z.infer<typeof FieldPlanSchema>;
```

---

## Consistent error messages (recommended wrapper)

To make error reporting stable and friendly, wrap Zod errors into your compiler error format:

```ts
import { ZodError } from "zod";

export function formatZodError(err: ZodError) {
  return err.issues.map((i) => ({
    code: "UIPLAN_INVALID",
    stage: "uiplan",
    jsonPointer: "/" + i.path.map(String).join("/"),
    message: i.message,
  }));
}
```

This gives you deterministic `jsonPointer`-style paths like:

* `/resources/0/views/list/fields/3/path`

