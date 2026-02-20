/**
 * ApiIR builder.
 * Orchestrates grouping + operation mapping.
 * Produces byte-stable ApiIR JSON.
 */

import stringify from "fast-json-stable-stringify";
import type { ApiIR, ResourceIR, OperationIR } from "./types";
import type { CompilerError } from "../errors";
import { groupOperations } from "./grouping";
import { mapOperation } from "./operations";
import { slugify } from "@/lib/utils/slugify";
import { sha256Hash } from "../hash";

const KIND_ORDER: OperationIR["kind"][] = ["list", "detail", "create", "update", "delete"];

function sortOperations(ops: OperationIR[]): OperationIR[] {
  return [...ops].sort((a, b) => {
    const aIdx = KIND_ORDER.indexOf(a.kind);
    const bIdx = KIND_ORDER.indexOf(b.kind);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
  });
}

export interface BuildApiIRResult {
  success: true;
  apiIr: ApiIR;
  apiIrHash: string;
}

export interface BuildApiIRFailure {
  success: false;
  error: CompilerError;
}

export type BuildApiIROutput = BuildApiIRResult | BuildApiIRFailure;

/**
 * Build ApiIR from canonical OpenAPI document (refs resolved).
 * Document must have passed subset validation.
 */
export function buildApiIR(doc: Record<string, unknown>): BuildApiIROutput {
  const info = doc.info as Record<string, unknown> | undefined;
  const title = (info?.title as string) ?? "API";
  const version = (info?.version as string) ?? "1.0.0";

  const paths = doc.paths as Record<string, unknown> | undefined;
  if (!paths || typeof paths !== "object") {
    return {
      success: false,
      error: {
        code: "IR_INVALID",
        stage: "ApiIR",
        message: "No paths in OpenAPI document",
      },
    };
  }

  const groupingResult = groupOperations(paths);
  if (!groupingResult.success) {
    return { success: false, error: groupingResult.error };
  }

  const resources: ResourceIR[] = [];
  const sortedKeys = [...groupingResult.groups.keys()].sort();

  for (const key of sortedKeys) {
    const group = groupingResult.groups.get(key)!;
    const operations: OperationIR[] = [];

    for (const raw of group.operations) {
      const mapResult = mapOperation(raw, doc);
      if (!mapResult.success) {
        return { success: false, error: mapResult.error };
      }
      operations.push(mapResult.operation);
    }

    const resourceKey = slugify(group.name);
    resources.push({
      name: group.name,
      key: resourceKey,
      operations: sortOperations(operations),
    });
  }

  const apiIr: ApiIR = {
    api: { title, version },
    resources,
  };

  const apiIrHash = sha256Hash(apiIr);

  return {
    success: true,
    apiIr,
    apiIrHash,
  };
}

/**
 * Produce deterministic JSON string from ApiIR.
 */
export function apiIrStringify(apiIr: ApiIR): string {
  return stringify(apiIr);
}
