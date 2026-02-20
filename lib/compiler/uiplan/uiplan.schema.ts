/**
 * UiPlanIR schema — Zod definitions for LLM output validation.
 * label is optional (no minLength) per plan correction.
 */

import { z } from "zod";

export const FieldPlanSchema = z
  .object({
    path: z.string().min(1),
    label: z.string().optional(),
    readOnly: z.boolean().optional(),
    order: z.number().optional(),
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
export type ViewsPlan = z.infer<typeof ViewsPlanSchema>;
export type FieldPlan = z.infer<typeof FieldPlanSchema>;
