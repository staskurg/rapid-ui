/**
 * Lowering — UiPlanIR + ApiIR → UISpec.
 */

export { lower } from "./lower";
export type { LowerOutput, LowerResult, LowerFailure } from "./lower";
export {
  extractSchemaFields,
  getObjectSchema,
  schemaToField,
} from "./schema-to-field";
export type { FieldInfo, FieldType } from "./schema-to-field";
