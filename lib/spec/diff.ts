/**
 * Spec diff utility — computes structured diff between two UISpecs.
 */

import type { Field, UISpec } from "./schema";

export type UISpecMap = Record<string, UISpec>;

export interface SpecDiff {
  entityChanged: boolean;
  fieldsAdded: string[];
  fieldsRemoved: string[];
  fieldsChanged: Array<{ name: string; prev: Field; next: Field }>;
  tableColumnsAdded: string[];
  tableColumnsRemoved: string[];
  formFieldsAdded: string[];
  formFieldsRemoved: string[];
  filtersAdded: string[];
  filtersRemoved: string[];
  idFieldChanged: boolean;
}

function fieldEquals(a: Field, b: Field): boolean {
  return (
    a.name === b.name &&
    a.label === b.label &&
    a.type === b.type &&
    a.required === b.required &&
    JSON.stringify(a.options ?? []) === JSON.stringify(b.options ?? [])
  );
}

/**
 * Compute structured diff between previous and next UISpec.
 */
export function computeSpecDiff(prev: UISpec, next: UISpec): SpecDiff {
  const prevFieldMap = new Map(prev.fields.map((f) => [f.name, f]));
  const nextFieldMap = new Map(next.fields.map((f) => [f.name, f]));

  const prevFieldNames = new Set(prev.fields.map((f) => f.name));
  const nextFieldNames = new Set(next.fields.map((f) => f.name));

  const fieldsAdded = [...nextFieldNames].filter((n) => !prevFieldNames.has(n));
  const fieldsRemoved = [...prevFieldNames].filter((n) => !nextFieldNames.has(n));

  const fieldsChanged: Array<{ name: string; prev: Field; next: Field }> = [];
  for (const name of prevFieldNames) {
    if (nextFieldNames.has(name)) {
      const p = prevFieldMap.get(name)!;
      const n = nextFieldMap.get(name)!;
      if (!fieldEquals(p, n)) {
        fieldsChanged.push({ name, prev: p, next: n });
      }
    }
  }

  const prevTableCols = new Set(prev.table.columns);
  const nextTableCols = new Set(next.table.columns);
  const tableColumnsAdded = [...nextTableCols].filter(
    (c) => !prevTableCols.has(c)
  );
  const tableColumnsRemoved = [...prevTableCols].filter(
    (c) => !nextTableCols.has(c)
  );

  const prevFormFields = new Set(prev.form.fields);
  const nextFormFields = new Set(next.form.fields);
  const formFieldsAdded = [...nextFormFields].filter(
    (f) => !prevFormFields.has(f)
  );
  const formFieldsRemoved = [...prevFormFields].filter(
    (f) => !nextFormFields.has(f)
  );

  const prevFilters = new Set(prev.filters);
  const nextFilters = new Set(next.filters);
  const filtersAdded = [...nextFilters].filter((f) => !prevFilters.has(f));
  const filtersRemoved = [...prevFilters].filter((f) => !nextFilters.has(f));

  const prevIdField = prev.idField ?? "id";
  const nextIdField = next.idField ?? "id";
  const idFieldChanged = prevIdField !== nextIdField;

  return {
    entityChanged: prev.entity !== next.entity,
    fieldsAdded,
    fieldsRemoved,
    fieldsChanged,
    tableColumnsAdded,
    tableColumnsRemoved,
    formFieldsAdded,
    formFieldsRemoved,
    filtersAdded,
    filtersRemoved,
    idFieldChanged,
  };
}

export interface MultiSpecDiff {
  resourcesAdded: string[];
  resourcesRemoved: string[];
  resourceDiffs: Record<string, SpecDiff>;
}

/**
 * Compute diff between two multi-resource UISpec maps.
 * Keys are resource slugs (e.g. "users", "tasks").
 */
export function computeMultiSpecDiff(
  prevSpecs: UISpecMap,
  nextSpecs: UISpecMap
): MultiSpecDiff {
  const prevKeys = new Set(Object.keys(prevSpecs));
  const nextKeys = new Set(Object.keys(nextSpecs));

  const resourcesAdded = [...nextKeys].filter((k) => !prevKeys.has(k));
  const resourcesRemoved = [...prevKeys].filter((k) => !nextKeys.has(k));

  const resourceDiffs: Record<string, SpecDiff> = {};
  for (const key of prevKeys) {
    if (nextKeys.has(key)) {
      resourceDiffs[key] = computeSpecDiff(prevSpecs[key], nextSpecs[key]);
    }
  }

  return {
    resourcesAdded,
    resourcesRemoved,
    resourceDiffs,
  };
}
