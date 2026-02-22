/**
 * Validation utilities for AI-generated UISpecs
 * Validates structural validity and logical integrity.
 */

import { UISpecSchema } from "@/lib/spec/schema";
import type { UISpec } from "@/lib/spec/types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LogicalIntegrityResult {
  isValid: boolean;
  issues: string[];
}

/**
 * Validate UISpec against Zod schema
 */
export function validateSchema(spec: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    UISpecSchema.parse(spec);
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    } else {
      errors.push(String(error));
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check logical integrity of a validated UISpec
 * Assumes spec has already passed schema validation
 */
export function checkLogicalIntegrity(spec: UISpec): LogicalIntegrityResult {
  const issues: string[] = [];

  // Check table columns
  if (spec.table.columns.length === 0) {
    issues.push("Table has no columns");
  }

  // Check form fields
  if (spec.form.fields.length === 0) {
    issues.push("Form has no fields");
  }

  // Check enum fields have options
  spec.fields.forEach((field) => {
    if (field.type === "enum") {
      if (!field.options || field.options.length === 0) {
        issues.push(`Enum field '${field.name}' has no options`);
      }
    }
  });

  // Check entity name
  if (!spec.entity || spec.entity.trim().length === 0) {
    issues.push("Entity name is empty");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Comprehensive validation combining schema and logical checks
 */
export function validateSpec(spec: unknown): {
  isValid: boolean;
  schemaResult: ValidationResult;
  logicalResult: LogicalIntegrityResult | null;
  errors: string[];
} {
  const schemaResult = validateSchema(spec);

  if (!schemaResult.isValid) {
    return {
      isValid: false,
      schemaResult,
      logicalResult: null,
      errors: schemaResult.errors,
    };
  }

  // If schema is valid, check logical integrity
  const logicalResult = checkLogicalIntegrity(spec as UISpec);
  const allErrors = [...schemaResult.errors, ...logicalResult.issues];

  return {
    isValid: schemaResult.isValid && logicalResult.isValid,
    schemaResult,
    logicalResult,
    errors: allErrors,
  };
}

export interface PerSpecValidationResult {
  isValid: boolean;
  schemaResult: ValidationResult;
  logicalResult: LogicalIntegrityResult | null;
  errors: string[];
}

/**
 * Validate multiple UISpecs (Record<slug, UISpec>).
 * All specs must pass for overall validity.
 */
export function validateSpecs(
  specs: Record<string, UISpec>
): {
  isValid: boolean;
  errors: string[];
  perSpec: Record<string, PerSpecValidationResult>;
} {
  const perSpec: Record<string, PerSpecValidationResult> = {};
  const errors: string[] = [];

  for (const [slug, spec] of Object.entries(specs)) {
    const result = validateSpec(spec);
    perSpec[slug] = {
      isValid: result.isValid,
      schemaResult: result.schemaResult,
      logicalResult: result.logicalResult,
      errors: result.errors,
    };
    if (!result.isValid) {
      errors.push(`[${slug}]: ${result.errors.join("; ")}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    perSpec,
  };
}
