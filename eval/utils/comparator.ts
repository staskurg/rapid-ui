/**
 * Structural comparison utilities for detecting drift across AI runs
 */

import stringify from "fast-json-stable-stringify";
import type { UISpec } from "@/lib/spec/types";
import type { UiPlanIR } from "@/lib/compiler/uiplan/uiplan.schema";

export interface StructuralFingerprint {
  fieldNames: Set<string>;
  fieldTypes: Map<string, string>;
  tableColumns: Set<string>;
  formFields: Set<string>;
  filterFields: Set<string>;
  enumFields: Map<string, string[]>; // field name -> options
}

export interface ComparisonResult {
  similarity: number; // 0-1 score
  differences: string[];
  consistent: boolean;
}

/**
 * Extract structural fingerprint from a UISpec
 */
export function extractFingerprint(spec: UISpec): StructuralFingerprint {
  const fieldNames = new Set<string>(spec.fields.map((f) => f.name));
  const fieldTypes = new Map<string, string>(
    spec.fields.map((f) => [f.name, f.type])
  );
  const tableColumns = new Set<string>(spec.table.columns);
  const formFields = new Set<string>(spec.form.fields);
  const filterFields = new Set<string>(spec.filters);
  const enumFields = new Map<string, string[]>();

  spec.fields.forEach((field) => {
    if (field.type === "enum" && field.options) {
      enumFields.set(field.name, [...field.options].sort());
    }
  });

  return {
    fieldNames,
    fieldTypes,
    tableColumns,
    formFields,
    filterFields,
    enumFields,
  };
}

/**
 * Compare two fingerprints and calculate similarity
 */
export function compareFingerprints(
  fp1: StructuralFingerprint,
  fp2: StructuralFingerprint
): ComparisonResult {
  const differences: string[] = [];

  // Compare field names
  const allFieldNames = new Set([...fp1.fieldNames, ...fp2.fieldNames]);
  const commonFields = new Set(
    [...fp1.fieldNames].filter((f) => fp2.fieldNames.has(f))
  );
  const onlyIn1 = [...fp1.fieldNames].filter((f) => !fp2.fieldNames.has(f));
  const onlyIn2 = [...fp2.fieldNames].filter((f) => !fp1.fieldNames.has(f));

  if (onlyIn1.length > 0) {
    differences.push(`Fields only in run 1: ${onlyIn1.join(", ")}`);
  }
  if (onlyIn2.length > 0) {
    differences.push(`Fields only in run 2: ${onlyIn2.join(", ")}`);
  }

  // Compare field types for common fields
  commonFields.forEach((fieldName) => {
    const type1 = fp1.fieldTypes.get(fieldName);
    const type2 = fp2.fieldTypes.get(fieldName);
    if (type1 !== type2) {
      differences.push(
        `Field '${fieldName}' has different types: ${type1} vs ${type2}`
      );
    }
  });

  // Compare enum options
  const allEnumFields = new Set([
    ...fp1.enumFields.keys(),
    ...fp2.enumFields.keys(),
  ]);
  allEnumFields.forEach((fieldName) => {
    const options1 = fp1.enumFields.get(fieldName) || [];
    const options2 = fp2.enumFields.get(fieldName) || [];
    const opts1Str = options1.join(",");
    const opts2Str = options2.join(",");
    if (opts1Str !== opts2Str) {
      differences.push(
        `Enum field '${fieldName}' has different options: [${opts1Str}] vs [${opts2Str}]`
      );
    }
  });

  // Compare table columns
  const tableDiff1 = [...fp1.tableColumns].filter(
    (c) => !fp2.tableColumns.has(c)
  );
  const tableDiff2 = [...fp2.tableColumns].filter(
    (c) => !fp1.tableColumns.has(c)
  );
  if (tableDiff1.length > 0 || tableDiff2.length > 0) {
    differences.push(
      `Table columns differ: [${[...fp1.tableColumns].join(", ")}] vs [${[...fp2.tableColumns].join(", ")}]`
    );
  }

  // Compare form fields
  const formDiff1 = [...fp1.formFields].filter((f) => !fp2.formFields.has(f));
  const formDiff2 = [...fp2.formFields].filter((f) => !fp1.formFields.has(f));
  if (formDiff1.length > 0 || formDiff2.length > 0) {
    differences.push(
      `Form fields differ: [${[...fp1.formFields].join(", ")}] vs [${[...fp2.formFields].join(", ")}]`
    );
  }

  // Compare filter fields
  const filterDiff1 = [...fp1.filterFields].filter((f) => !fp2.filterFields.has(f));
  const filterDiff2 = [...fp2.filterFields].filter((f) => !fp1.filterFields.has(f));
  if (filterDiff1.length > 0 || filterDiff2.length > 0) {
    differences.push(
      `Filter fields differ: [${[...fp1.filterFields].join(", ")}] vs [${[...fp2.filterFields].join(", ")}]`
    );
  }

  // Calculate similarity score (0-1)
  // Simple approach: count matching elements / total elements
  let matchingElements = 0;
  let totalElements = 0;

  // Field names
  totalElements += allFieldNames.size;
  matchingElements += commonFields.size;

  // Field types (for common fields)
  commonFields.forEach((fieldName) => {
    totalElements += 1;
    if (fp1.fieldTypes.get(fieldName) === fp2.fieldTypes.get(fieldName)) {
      matchingElements += 1;
    }
  });

  // Table columns
  const allTableCols = new Set([...fp1.tableColumns, ...fp2.tableColumns]);
  totalElements += allTableCols.size;
  matchingElements += [...allTableCols].filter(
    (c) => fp1.tableColumns.has(c) && fp2.tableColumns.has(c)
  ).length;

  // Form fields
  const allFormFields = new Set([...fp1.formFields, ...fp2.formFields]);
  totalElements += allFormFields.size;
  matchingElements += [...allFormFields].filter(
    (f) => fp1.formFields.has(f) && fp2.formFields.has(f)
  ).length;

  // Filter fields
  const allFilterFields = new Set([...fp1.filterFields, ...fp2.filterFields]);
  totalElements += allFilterFields.size;
  matchingElements += [...allFilterFields].filter(
    (f) => fp1.filterFields.has(f) && fp2.filterFields.has(f)
  ).length;

  const similarity =
    totalElements > 0 ? matchingElements / totalElements : 1.0;

  return {
    similarity,
    differences,
    consistent: differences.length === 0,
  };
}

/**
 * Compare multiple fingerprints and find the most common structure
 */
export function compareMultipleFingerprints(
  fingerprints: StructuralFingerprint[]
): {
  averageSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  allDifferences: string[];
  consistent: boolean;
} {
  if (fingerprints.length === 0) {
    return {
      averageSimilarity: 1.0,
      minSimilarity: 1.0,
      maxSimilarity: 1.0,
      allDifferences: [],
      consistent: true,
    };
  }

  if (fingerprints.length === 1) {
    return {
      averageSimilarity: 1.0,
      minSimilarity: 1.0,
      maxSimilarity: 1.0,
      allDifferences: [],
      consistent: true,
    };
  }

  const comparisons: ComparisonResult[] = [];
  const allDifferences = new Set<string>();

  // Compare all pairs
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const result = compareFingerprints(fingerprints[i], fingerprints[j]);
      comparisons.push(result);
      result.differences.forEach((d) => allDifferences.add(d));
    }
  }

  const similarities = comparisons.map((c) => c.similarity);
  const averageSimilarity =
    similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const minSimilarity = Math.min(...similarities);
  const maxSimilarity = Math.max(...similarities);

  return {
    averageSimilarity,
    minSimilarity,
    maxSimilarity,
    allDifferences: [...allDifferences],
    consistent: allDifferences.size === 0,
  };
}

// --- Multi-spec (Record<slug, UISpec>) comparison ---

/**
 * Produce stable canonical string for Record<slug, UISpec>.
 * Used for byte-identical comparison.
 */
export function canonicalString(specs: Record<string, UISpec>): string {
  const sorted: Record<string, UISpec> = {};
  for (const k of Object.keys(specs).sort()) {
    sorted[k] = specs[k];
  }
  return stringify(sorted);
}

/**
 * Compare two multi-spec runs.
 * Asserts same slugs; per-resource fingerprint comparison.
 * Overall similarity = min of per-resource similarities (each resource must ≥ threshold).
 */
export function compareSpecsMulti(
  run1: Record<string, UISpec>,
  run2: Record<string, UISpec>
): {
  sameSlugs: boolean;
  slugMismatch?: string;
  perResource: Record<string, { similarity: number; differences: string[] }>;
  minSimilarity: number;
  differences: string[];
} {
  const slugs1 = new Set(Object.keys(run1));
  const slugs2 = new Set(Object.keys(run2));

  if (slugs1.size !== slugs2.size) {
    return {
      sameSlugs: false,
      slugMismatch: `Different resource counts: ${slugs1.size} vs ${slugs2.size}`,
      perResource: {},
      minSimilarity: 0,
      differences: [
        `Slugs differ: [${[...slugs1].sort().join(", ")}] vs [${[...slugs2].sort().join(", ")}]`,
      ],
    };
  }

  const only1 = [...slugs1].filter((s) => !slugs2.has(s));
  const only2 = [...slugs2].filter((s) => !slugs1.has(s));
  if (only1.length > 0 || only2.length > 0) {
    return {
      sameSlugs: false,
      slugMismatch: `Different slugs: only in run1: ${only1.join(", ")}; only in run2: ${only2.join(", ")}`,
      perResource: {},
      minSimilarity: 0,
      differences: [
        `Slugs differ: [${[...slugs1].sort().join(", ")}] vs [${[...slugs2].sort().join(", ")}]`,
      ],
    };
  }

  const perResource: Record<string, { similarity: number; differences: string[] }> = {};
  let minSim = 1;
  const allDiffs: string[] = [];

  for (const slug of slugs1) {
    const fp1 = extractFingerprint(run1[slug]);
    const fp2 = extractFingerprint(run2[slug]);
    const result = compareFingerprints(fp1, fp2);
    perResource[slug] = {
      similarity: result.similarity,
      differences: result.differences,
    };
    minSim = Math.min(minSim, result.similarity);
    result.differences.forEach((d) => allDiffs.push(`[${slug}] ${d}`));
  }

  return {
    sameSlugs: true,
    perResource,
    minSimilarity: minSim,
    differences: allDiffs,
  };
}

/**
 * Human-readable diff between two canonical strings.
 */
export function diffCanonical(a: string, b: string): string {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const maxLen = Math.max(linesA.length, linesB.length);
  const out: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const la = linesA[i] ?? "";
    const lb = linesB[i] ?? "";
    const prefix = la === lb ? "  " : la === "" ? "+ " : lb === "" ? "- " : "! ";
    const content = la === lb ? la : `run1: ${la} | run2: ${lb}`;
    if (la !== lb) {
      out.push(`${prefix}${content}`);
    }
  }
  return out.length > 0 ? out.join("\n") : "(identical)";
}

// --- UiPlanIR fingerprint (for LLM-only evals) ---

export interface UiPlanIRFingerprint {
  resourceNames: Set<string>;
  perResource: Record<
    string,
    { listPaths: string[]; detailPaths: string[]; createPaths: string[]; editPaths: string[] }
  >;
}

/**
 * Extract structural fingerprint from normalized UiPlanIR.
 */
export function extractUiPlanIRFingerprint(uiPlan: UiPlanIR): UiPlanIRFingerprint {
  const resourceNames = new Set(uiPlan.resources.map((r) => r.name));
  const perResource: UiPlanIRFingerprint["perResource"] = {};

  for (const res of uiPlan.resources) {
    const listPaths = (res.views.list?.fields ?? []).map((f) => f.path).sort();
    const detailPaths = (res.views.detail?.fields ?? []).map((f) => f.path).sort();
    const createPaths = (res.views.create?.fields ?? []).map((f) => f.path).sort();
    const editPaths = (res.views.edit?.fields ?? []).map((f) => f.path).sort();
    perResource[res.name] = {
      listPaths,
      detailPaths,
      createPaths,
      editPaths,
    };
  }

  return { resourceNames, perResource };
}

/**
 * Compare two UiPlanIR fingerprints; returns similarity 0-1.
 */
export function compareUiPlanIRFingerprints(
  fp1: UiPlanIRFingerprint,
  fp2: UiPlanIRFingerprint
): { similarity: number; differences: string[] } {
  const differences: string[] = [];

  const allRes = new Set<string>([...fp1.resourceNames, ...fp2.resourceNames]);
  const only1 = [...fp1.resourceNames].filter((r) => !fp2.resourceNames.has(r));
  const only2 = [...fp2.resourceNames].filter((r) => !fp1.resourceNames.has(r));
  if (only1.length > 0) differences.push(`Resources only in run1: ${only1.join(", ")}`);
  if (only2.length > 0) differences.push(`Resources only in run2: ${only2.join(", ")}`);

  let totalScore = 0;
  let totalWeight = 0;

  for (const res of allRes) {
    const r1 = fp1.perResource[res];
    const r2 = fp2.perResource[res];
    if (!r1 || !r2) {
      totalWeight += 1;
      continue;
    }

    const viewKeys = ["listPaths", "detailPaths", "createPaths", "editPaths"] as const;
    for (const key of viewKeys) {
      const s1 = new Set(r1[key]);
      const s2 = new Set(r2[key]);
      const union = new Set([...s1, ...s2]);
      const intersection = [...s1].filter((p) => s2.has(p));
      const sim = union.size > 0 ? intersection.length / union.size : 1;
      totalScore += sim;
      totalWeight += 1;
      if (sim < 1) {
        const onlyIn1 = [...s1].filter((p) => !s2.has(p));
        const onlyIn2 = [...s2].filter((p) => !s1.has(p));
        if (onlyIn1.length > 0 || onlyIn2.length > 0) {
          differences.push(
            `[${res}] ${key}: only run1: [${onlyIn1.join(", ")}]; only run2: [${onlyIn2.join(", ")}]`
          );
        }
      }
    }
  }

  const similarity = totalWeight > 0 ? totalScore / totalWeight : 1;
  return { similarity, differences };
}
