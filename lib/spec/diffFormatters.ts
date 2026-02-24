/**
 * Diff formatter — converts SpecDiff to display strings for toast.
 * Consolidated format "Field Label (Table, Form, Filters)" — one line per field.
 */

import type { MultiSpecDiff, SpecDiff, UISpecMap } from "./diff";
import type { UISpec } from "./schema";

const MAX_ITEMS = 7;

function getFieldLabel(spec: UISpec | undefined, fieldName: string): string {
  if (!spec) return humanize(fieldName);
  const field = spec.fields.find((f) => f.name === fieldName);
  return field?.label ?? humanize(fieldName);
}

function humanize(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export interface FormatDiffResult {
  added: string[];
  removed: string[];
}

type Area = "Table" | "Form" | "Filters";

function formatAreas(areas: Area[]): string {
  if (areas.length === 0) return "";
  return ` (${areas.join(", ")})`;
}

/**
 * Consolidate changes by field name: "Field Label (Table, Form, Filters)" — one line per field.
 */
export function formatDiffForDisplay(
  diff: SpecDiff,
  prevSpec?: UISpec,
  nextSpec?: UISpec
): FormatDiffResult {
  const addedMap = new Map<string, Area[]>();
  const removedMap = new Map<string, Area[]>();

  const addArea = (
    map: Map<string, Area[]>,
    fieldName: string,
    area: Area,
    spec: UISpec | undefined
  ) => {
    const label = getFieldLabel(spec, fieldName);
    const arr = map.get(label) ?? [];
    if (!arr.includes(area)) arr.push(area);
    map.set(label, arr);
  };

  const addField = (
    map: Map<string, Area[]>,
    name: string,
    areas: Area[],
    spec: UISpec | undefined
  ) => {
    const label = getFieldLabel(spec, name);
    const existing = map.get(label);
    if (existing) {
      for (const a of areas) {
        if (!existing.includes(a)) existing.push(a);
      }
    } else {
      map.set(label, [...areas]);
    }
  };

  // Entity change
  if (diff.entityChanged) {
    addedMap.set(`Entity: ${nextSpec?.entity ?? "—"}`, []);
    removedMap.set(`Entity: ${prevSpec?.entity ?? "—"}`, []);
  }

  // Fields: add/remove with areas
  for (const name of diff.fieldsAdded) {
    const areas: Area[] = [];
    if (diff.tableColumnsAdded.includes(name)) areas.push("Table");
    if (diff.formFieldsAdded.includes(name)) areas.push("Form");
    if (diff.filtersAdded.includes(name)) areas.push("Filters");
    addField(addedMap, name, areas, nextSpec);
  }
  for (const name of diff.fieldsRemoved) {
    const areas: Area[] = [];
    if (diff.tableColumnsRemoved.includes(name)) areas.push("Table");
    if (diff.formFieldsRemoved.includes(name)) areas.push("Form");
    if (diff.filtersRemoved.includes(name)) areas.push("Filters");
    addField(removedMap, name, areas, prevSpec);
  }

  // Table/Form/Filters-only changes (field exists, just area change)
  for (const name of diff.tableColumnsAdded) {
    if (!diff.fieldsAdded.includes(name))
      addArea(addedMap, name, "Table", nextSpec);
  }
  for (const name of diff.tableColumnsRemoved) {
    if (!diff.fieldsRemoved.includes(name))
      addArea(removedMap, name, "Table", prevSpec);
  }
  for (const name of diff.formFieldsAdded) {
    if (!diff.fieldsAdded.includes(name))
      addArea(addedMap, name, "Form", nextSpec);
  }
  for (const name of diff.formFieldsRemoved) {
    if (!diff.fieldsRemoved.includes(name))
      addArea(removedMap, name, "Form", prevSpec);
  }
  for (const name of diff.filtersAdded) {
    if (!diff.fieldsAdded.includes(name))
      addArea(addedMap, name, "Filters", nextSpec);
  }
  for (const name of diff.filtersRemoved) {
    if (!diff.fieldsRemoved.includes(name))
      addArea(removedMap, name, "Filters", prevSpec);
  }

  // Fields changed (label/type)
  for (const { prev, next } of diff.fieldsChanged) {
    removedMap.set(prev.label, []);
    addedMap.set(
      prev.label !== next.label ? next.label : `${prev.label} (type changed)`,
      []
    );
  }

  // idField
  if (diff.idFieldChanged) {
    addedMap.set(`ID field: ${nextSpec?.idField ?? "id"}`, []);
    removedMap.set(`ID field: ${prevSpec?.idField ?? "id"}`, []);
  }

  // Convert maps to arrays: "Label (Table, Form)" or "Label"
  const added: string[] = [];
  for (const [label, areas] of addedMap) {
    if (areas.length > 0) {
      areas.sort((a, b) => ["Table", "Form", "Filters"].indexOf(a) - ["Table", "Form", "Filters"].indexOf(b));
      added.push(`${label}${formatAreas(areas)}`);
    } else {
      added.push(label);
    }
  }
  const removed: string[] = [];
  for (const [label, areas] of removedMap) {
    if (areas.length > 0) {
      areas.sort((a, b) => ["Table", "Form", "Filters"].indexOf(a) - ["Table", "Form", "Filters"].indexOf(b));
      removed.push(`${label}${formatAreas(areas)}`);
    } else {
      removed.push(label);
    }
  }

  // Cap at ~7 items total
  const total = added.length + removed.length;
  let cappedAdded = added;
  let cappedRemoved = removed;
  if (total > MAX_ITEMS) {
    const maxAdded = Math.min(added.length, 4);
    const maxRemoved = Math.min(removed.length, MAX_ITEMS - maxAdded);
    cappedAdded = added.slice(0, maxAdded);
    cappedRemoved = removed.slice(0, maxRemoved);
    const extra = total - cappedAdded.length - cappedRemoved.length;
    if (extra > 0) {
      cappedAdded.push(`${extra} more…`);
    }
  }

  return {
    added: cappedAdded,
    removed: cappedRemoved,
  };
}

/**
 * Format multi-resource diff for display.
 * Returns raw semantic strings: page-level = entity name, field-level = field names.
 * UI adds ++/-- when rendering.
 */
export function formatMultiSpecDiffForDisplay(
  multiDiff: MultiSpecDiff,
  prevSpecs: UISpecMap,
  nextSpecs: UISpecMap
): FormatDiffResult {
  const added: string[] = [];
  const removed: string[] = [];

  // Page-level: resource entity names
  for (const slug of multiDiff.resourcesAdded) {
    const spec = nextSpecs[slug];
    added.push(spec?.entity ?? humanize(slug));
  }
  for (const slug of multiDiff.resourcesRemoved) {
    const spec = prevSpecs[slug];
    removed.push(spec?.entity ?? humanize(slug));
  }

  // Field-level: field names (humanized) from per-resource diffs
  for (const diff of Object.values(multiDiff.resourceDiffs)) {
    for (const name of diff.fieldsAdded) {
      added.push(humanize(name));
    }
    for (const name of diff.fieldsRemoved) {
      removed.push(humanize(name));
    }
    for (const { name } of diff.fieldsChanged) {
      added.push(humanize(name));
      removed.push(humanize(name));
    }
    for (const name of diff.tableColumnsAdded) {
      if (!diff.fieldsAdded.includes(name)) added.push(humanize(name));
    }
    for (const name of diff.tableColumnsRemoved) {
      if (!diff.fieldsRemoved.includes(name)) removed.push(humanize(name));
    }
    for (const name of diff.formFieldsAdded) {
      if (!diff.fieldsAdded.includes(name)) added.push(humanize(name));
    }
    for (const name of diff.formFieldsRemoved) {
      if (!diff.fieldsRemoved.includes(name)) removed.push(humanize(name));
    }
    for (const name of diff.filtersAdded) {
      if (!diff.fieldsAdded.includes(name)) added.push(humanize(name));
    }
    for (const name of diff.filtersRemoved) {
      if (!diff.fieldsRemoved.includes(name)) removed.push(humanize(name));
    }
  }

  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
  };
}
