/**
 * Structural comparison utilities for detecting drift across AI runs
 */

import type { UISpec } from "@/lib/spec/types";

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
  const fieldNames = new Set(spec.fields.map((f) => f.name));
  const fieldTypes = new Map(
    spec.fields.map((f) => [f.name, f.type])
  );
  const tableColumns = new Set(spec.table.columns);
  const formFields = new Set(spec.form.fields);
  const filterFields = new Set(spec.filters);
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
