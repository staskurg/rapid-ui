/**
 * Lowering: UiPlanIR + ApiIR → UISpec.
 * Produces deterministic UISpec consumed by existing SchemaRenderer.
 */

import { UISpecSchema } from "@/lib/spec/schema";
import type { UISpec, Field } from "@/lib/spec/types";
import type { ApiIR, ResourceIR } from "../apiir/types";
import type { UiPlanIR, ResourcePlan, FieldPlan } from "../uiplan/uiplan.schema";
import { slugify } from "@/lib/utils/slugify";
import {
  extractSchemaFields,
  schemaToField,
  type FieldInfo,
} from "./schema-to-field";
import { createError } from "../errors";
import type { CompilerError } from "../errors";

export interface LowerResult {
  success: true;
  specs: Record<string, UISpec>;
}

export interface LowerFailure {
  success: false;
  error: CompilerError;
}

export type LowerOutput = LowerResult | LowerFailure;

/**
 * Lower normalized UiPlanIR + ApiIR to UISpec map.
 * Keyed by resource slug. Each UISpec validated with UISpecSchema.
 */
export function lower(uiPlan: UiPlanIR, apiIr: ApiIR): LowerOutput {
  const resourceMap = new Map(
    apiIr.resources.map((r) => [slugify(r.name), r] as const)
  );

  const specs: Record<string, UISpec> = {};

  for (const plan of uiPlan.resources) {
    const slug = slugify(plan.name);
    const resource = resourceMap.get(slug);
    if (!resource) {
      return {
        success: false,
        error: createError(
          "UISPEC_INVALID",
          "Lowering",
          `Resource "${plan.name}" not found in ApiIR`
        ),
      };
    }

    const spec = lowerResource(plan, resource);
    if (!spec.success) return spec;
    specs[slug] = spec.spec;
  }

  return { success: true, specs };
}

function lowerResource(
  plan: ResourcePlan,
  resource: ResourceIR
): { success: true; spec: UISpec } | LowerFailure {
  const schemaMap = mergeSchemaFields(resource);
  const fieldPlanMap = collectFieldPlans(plan);

  const fields: Field[] = [];
  const seenPaths = new Set<string>();

  const sortedPlans = [...fieldPlanMap.entries()].sort((a, b) => {
    const [pathA, fpA] = a;
    const [pathB, fpB] = b;
    const orderA = fpA.order ?? Number.POSITIVE_INFINITY;
    const orderB = fpB.order ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return pathA.localeCompare(pathB);
  });

  for (const [path, fieldPlan] of sortedPlans) {
    const info = schemaMap.get(path);
    if (!info) continue;
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);

    const label = fieldPlan.label;
    const field = schemaToField(path, label, info, fieldPlan.readOnly);
    fields.push(field);
  }

  if (fields.length === 0) {
    return {
      success: false,
      error: createError(
        "UISPEC_INVALID",
        "Lowering",
        `Resource "${plan.name}" has no valid fields`
      ),
    };
  }

  const listPaths = getViewPaths(plan, "list");
  const createPaths = getViewPaths(plan, "create");
  const editPaths = getViewPaths(plan, "edit");

  const tableColumns = listPaths.filter((p) => schemaMap.has(p));
  const formFields = mergeFormFields(createPaths, editPaths);

  const fieldNames = new Set(fields.map((f) => f.name));
  const validFormFields = formFields.filter((p) => fieldNames.has(p));
  const validTableColumns = tableColumns.filter((p) => fieldNames.has(p));

  const filterableTypes = new Set(["string", "number", "enum"]);
  const filters = listPaths.filter((p) => {
    const info = schemaMap.get(p);
    return info && filterableTypes.has(info.type);
  });

  const idField = inferIdField(resource);

  const spec: UISpec = {
    entity: plan.name,
    fields,
    table: { columns: validTableColumns.length ? validTableColumns : [fields[0].name] },
    form: { fields: validFormFields.length ? validFormFields : [fields[0].name] },
    filters,
    ...(idField && { idField }),
  };

  const parsed = UISpecSchema.safeParse(spec);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      error: createError(
        "UISPEC_INVALID",
        "Lowering",
        first?.message ?? "UISpec validation failed",
        first?.path?.join("/")
      ),
    };
  }

  return { success: true, spec: parsed.data };
}

function mergeSchemaFields(resource: ResourceIR): Map<string, FieldInfo> {
  const merged = new Map<string, FieldInfo>();

  const listOp = resource.operations.find((o) => o.kind === "list");
  const detailOp = resource.operations.find((o) => o.kind === "detail");
  const createOp = resource.operations.find((o) => o.kind === "create");
  const updateOp = resource.operations.find((o) => o.kind === "update");

  const schemas: Record<string, unknown>[] = [];
  if (listOp?.responseSchema) schemas.push(listOp.responseSchema as Record<string, unknown>);
  if (detailOp?.responseSchema) schemas.push(detailOp.responseSchema as Record<string, unknown>);
  if (createOp?.requestSchema) schemas.push(createOp.requestSchema as Record<string, unknown>);
  if (updateOp?.requestSchema) schemas.push(updateOp.requestSchema as Record<string, unknown>);

  for (const schema of schemas) {
    const requiredArr = (schema.required as string[] | undefined) ?? [];
    const fields = extractSchemaFields(schema, requiredArr);
    for (const [path, info] of fields) {
      const existing = merged.get(path);
      if (!existing) {
        merged.set(path, info);
      } else {
        merged.set(path, {
          ...info,
          required: existing.required || info.required,
          options: info.options ?? existing.options,
        });
      }
    }
  }

  return merged;
}

function collectFieldPlans(plan: ResourcePlan): Map<string, FieldPlan> {
  const map = new Map<string, FieldPlan>();
  const views = ["list", "detail", "create", "edit"] as const;
  for (const view of views) {
    const viewPlan = plan.views[view];
    if (!viewPlan) continue;
    for (const fp of viewPlan.fields) {
      map.set(fp.path, fp);
    }
  }
  return map;
}

function getViewPaths(plan: ResourcePlan, view: keyof ResourcePlan["views"]): string[] {
  const viewPlan = plan.views[view];
  if (!viewPlan) return [];
  return viewPlan.fields.map((f) => f.path);
}

function mergeFormFields(createPaths: string[], editPaths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of [...createPaths, ...editPaths]) {
    if (seen.has(p)) continue;
    seen.add(p);
    result.push(p);
  }
  return result;
}

function inferIdField(resource: ResourceIR): string | undefined {
  const detailOp = resource.operations.find((o) => o.kind === "detail");
  const updateOp = resource.operations.find((o) => o.kind === "update");
  const deleteOp = resource.operations.find((o) => o.kind === "delete");

  const param =
    detailOp?.identifierParam ??
    updateOp?.identifierParam ??
    deleteOp?.identifierParam;

  if (!param) return undefined;

  const listOp = resource.operations.find((o) => o.kind === "list");
  const schema = listOp?.responseSchema;
  if (!schema) return param;

  const objSchema = schema.type === "array" ? schema.items : schema;
  const props = (objSchema as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
  if (props && "id" in props) return "id";

  return param;
}
