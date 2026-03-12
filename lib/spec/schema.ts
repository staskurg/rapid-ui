import { z } from "zod";

/**
 * Field type enum - supported field types for the UI spec
 */
export const FieldTypeSchema = z.enum(["string", "number", "boolean", "enum", "object"]);

/**
 * Field schema - defines a single field in the entity
 */
export const FieldSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  label: z.string().min(1, "Field label is required"),
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // Required for enum type
  readOnly: z.boolean().optional(),
});

/**
 * Table configuration schema - defines which fields appear as columns.
 * Optional when resource has no list capability.
 */
export const TableConfigSchema = z.object({
  columns: z.array(z.string()).min(1, "At least one column is required"),
});

/**
 * Form configuration schema - defines field order for forms.
 * Optional when resource has no create/update capability.
 */
export const FormConfigSchema = z.object({
  fields: z.array(z.string()).min(1, "At least one form field is required"),
});

/**
 * Detail view configuration - fields for detail view.
 * Optional when resource has no detail capability.
 */
export const DetailConfigSchema = z.object({
  fields: z.array(z.string()),
});

/**
 * UI Spec schema - the complete specification for generating a schema-driven UI.
 * table, form, detail, filters are optional (capability-driven).
 */
export const UISpecSchema = z
  .object({
    entity: z.string().min(1, "Entity name is required"),
    fields: z.array(FieldSchema).min(1, "At least one field is required"),
    table: TableConfigSchema.optional(),
    form: FormConfigSchema.optional(),
    detail: DetailConfigSchema.optional(),
    filters: z.array(z.string()).optional().default([]),
    idField: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.table) return true;
      const fieldNames = new Set(data.fields.map((f) => f.name));
      return data.table.columns.every((col) => fieldNames.has(col));
    },
    {
      message: "Table columns must reference existing field names",
      path: ["table", "columns"],
    }
  )
  .refine(
    (data) => {
      if (!data.form) return true;
      const fieldNames = new Set(data.fields.map((f) => f.name));
      return data.form.fields.every((field) => fieldNames.has(field));
    },
    {
      message: "Form fields must reference existing field names",
      path: ["form", "fields"],
    }
  )
  .refine(
    (data) => {
      const f = data.filters ?? [];
      const fieldNames = new Set(data.fields.map((f) => f.name));
      return f.every((filter) => fieldNames.has(filter));
    },
    {
      message: "Filter fields must reference existing field names",
      path: ["filters"],
    }
  )
  .refine(
    (data) => {
      if (!data.detail) return true;
      const fieldNames = new Set(data.fields.map((f) => f.name));
      return data.detail.fields.every((field) => fieldNames.has(field));
    },
    {
      message: "Detail fields must reference existing field names",
      path: ["detail", "fields"],
    }
  )
  .refine(
    (data) => {
      // Validate that enum fields have options array
      return data.fields.every((field) => {
        if (field.type === "enum") {
          return field.options && field.options.length > 0;
        }
        if (field.type === "object") {
          return true; // object type has no options
        }
        return true;
      });
    },
    {
      message: "Enum fields must have an options array",
      path: ["fields"],
    }
  );

/**
 * Type exports for use in validation
 */
export type FieldType = z.infer<typeof FieldTypeSchema>;
export type Field = z.infer<typeof FieldSchema>;
export type TableConfig = z.infer<typeof TableConfigSchema>;
export type FormConfig = z.infer<typeof FormConfigSchema>;
export type DetailConfig = z.infer<typeof DetailConfigSchema>;
export type UISpec = z.infer<typeof UISpecSchema>;
