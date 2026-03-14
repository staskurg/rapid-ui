/**
 * Identity fields derivation: derive per-resource identityFields from
 * detail/update/delete operations. MVP: single path param only (length 0 or 1).
 */

import type { ApiIR, ResourceIR } from "./types";
import type { CompilerError } from "../errors";
import { createError } from "../errors";

function isIdentityKind(kind: string): kind is "detail" | "update" | "delete" {
  return kind === "detail" || kind === "update" || kind === "delete";
}

export interface DeriveIdentityFieldsResult {
  success: true;
}

export interface DeriveIdentityFieldsFailure {
  success: false;
  error: CompilerError;
}

export type DeriveIdentityFieldsOutput =
  | DeriveIdentityFieldsResult
  | DeriveIdentityFieldsFailure;

/**
 * Derive identityFields for a resource from its operations.
 * Collects identifierParam from detail/update/delete ops.
 * MVP: enforces identityFields.length <= 1; rejects multi-param with compile error.
 */
function deriveIdentityFieldsForResource(
  resource: ResourceIR
): { identityFields: string[] } | { error: CompilerError } {
  const params = new Set<string>();
  for (const op of resource.operations) {
    if (isIdentityKind(op.kind) && op.identifierParam) {
      params.add(op.identifierParam);
    }
  }

  if (params.size === 0) {
    return { identityFields: [] };
  }

  if (params.size > 1) {
    return {
      error: createError(
        "IR_INVALID",
        "ApiIR",
        `Multi-param path not supported for MVP: resource "${resource.name}" has identity params [${[...params].sort().join(", ")}]; only single path param allowed`,
        `/resources/${resource.key}`
      ),
    };
  }

  return { identityFields: [params.values().next().value!] };
}

/**
 * Derive identityFields for all resources and embed in apiIr.resources[].identityFields.
 * Mutates apiIr in place. Call after deriveCapabilities.
 * Returns error if any resource has multi-param (MVP constraint).
 */
export function deriveIdentityFields(
  apiIr: ApiIR
): DeriveIdentityFieldsOutput {
  for (const resource of apiIr.resources) {
    const result = deriveIdentityFieldsForResource(resource);
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    resource.identityFields = result.identityFields;
  }
  return { success: true };
}
