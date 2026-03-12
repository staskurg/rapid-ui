/**
 * Lowering: UiPlanIR + ApiIR → UISpec.
 * Produces deterministic UISpec consumed by existing SchemaRenderer.
 */

import { UISpecSchema } from "@/lib/spec/schema";
import type { UISpec, Field } from "@/lib/spec/types";
import type { ApiIR, ResourceIR, Capabilities } from "../apiir/types";
import type { UiPlanIR, ResourcePlan, FieldPlan } from "../uiplan/uiplan.schema";
import { slugify } from "@/lib/utils/slugify";
import {
  extractSchemaFields,
  getObjectShape,
  getObjectSchema,
  SCHEMA_SHAPE_PLACEHOLDER,
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
 * Capability decisions come from capabilitiesBySlug only (no ad hoc inference from operations).
 */
export function lower(
  apiIr: ApiIR,
  uiPlan: UiPlanIR,
  capabilitiesBySlug: Record<string, Capabilities>
): LowerOutput {
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

    const caps = capabilitiesBySlug[resource.key];
    if (!caps) {
      return {
        success: false,
        error: createError(
          "UISPEC_INVALID",
          "Lowering",
          `No capabilities for resource "${plan.name}" (key: ${resource.key})`
        ),
      };
    }
    const spec = lowerResource(plan, resource, caps);
    if (!spec.success) return spec;
    specs[slug] = spec.spec;
  }

  return { success: true, specs };
}

function lowerResource(
  plan: ResourcePlan,
  resource: ResourceIR,
  capabilities: Capabilities
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

  // Schema-shape placeholder: when resource has opaque/map shape (fieldless), add display placeholder
  if (fields.length === 0 && hasOpaqueOrMapShape(resource)) {
    fields.push(
      schemaToField(
        SCHEMA_SHAPE_PLACEHOLDER,
        undefined,
        { type: "object", required: false },
        false
      )
    );
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
  const detailPaths = getViewPaths(plan, "detail");

  const fieldNames = new Set(fields.map((f) => f.name));
  const validTableColumns = listPaths.filter((p) => schemaMap.has(p) && fieldNames.has(p));
  const formFields = mergeFormFields(createPaths, editPaths);
  const validFormFields = formFields.filter((p) => fieldNames.has(p));
  const validDetailFields = detailPaths.filter((p) => fieldNames.has(p));

  const filterableTypes = new Set(["string", "number", "enum"]);
  const filters = listPaths.filter((p) => {
    const info = schemaMap.get(p);
    return info && filterableTypes.has(info.type);
  });

  const idField = inferIdField(resource);

  // Emit sections only when capabilities allow (Phase 1.2)
  const spec: UISpec = {
    entity: plan.name,
    fields,
    ...(capabilities.list && {
      table: {
        columns: validTableColumns.length ? validTableColumns : [fields[0].name],
      },
    }),
    ...((capabilities.create || capabilities.update) && {
      form: {
        fields: validFormFields.length ? validFormFields : [fields[0].name],
      },
    }),
    ...(capabilities.detail &&
      validDetailFields.length > 0 && {
        detail: { fields: validDetailFields },
      }),
    filters: capabilities.list ? filters : [],
    ...(idField && { idField }),
  };

  const consistencyErr = assertCapabilityConsistency(spec, capabilities);
  if (consistencyErr) return consistencyErr;

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

  const validated = validateUISpecAgainstCapabilities(parsed.data, capabilities);
  if (!validated.success) return validated;

  return { success: true, spec: validated.spec };
}

function assertCapabilityConsistency(
  spec: UISpec,
  capabilities: Capabilities
): LowerFailure | null {
  if (capabilities.list && !spec.table) {
    return {
      success: false,
      error: createError(
        "UISPEC_INVALID",
        "Lowering",
        "capabilities.list is true but table section is missing"
      ),
    };
  }
  if ((capabilities.create || capabilities.update) && !spec.form) {
    return {
      success: false,
      error: createError(
        "UISPEC_INVALID",
        "Lowering",
        "capabilities.create or update is true but form section is missing"
      ),
    };
  }
  return null;
}

function validateUISpecAgainstCapabilities(
  spec: UISpec,
  capabilities: Capabilities
): { success: true; spec: UISpec } | LowerFailure {
  // Re-assert consistency before returning (never snapshot unvalidated output)
  const err = assertCapabilityConsistency(spec, capabilities);
  if (err) return err;
  return { success: true, spec };
}

function hasOpaqueOrMapShape(resource: ResourceIR): boolean {
  const listOp = resource.operations.find((o) => o.kind === "list");
  const detailOp = resource.operations.find((o) => o.kind === "detail");
  const schemas: Record<string, unknown>[] = [];
  if (listOp?.responseSchema) schemas.push(listOp.responseSchema as Record<string, unknown>);
  if (detailOp?.responseSchema) schemas.push(detailOp.responseSchema as Record<string, unknown>);
  for (const schema of schemas) {
    const objSchema = getObjectSchema(schema);
    if (objSchema) {
      const shape = getObjectShape(objSchema);
      if (shape === "opaque" || shape === "map") return true;
    }
  }
  return false;
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
