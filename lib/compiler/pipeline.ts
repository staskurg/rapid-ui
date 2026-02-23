/**
 * Compiler pipeline: OpenAPI → UISpec.
 * Orchestrates parse → validate → canonicalize → apiir → llm → normalize → lower.
 */

import { parseOpenAPI } from "./openapi/parser";
import { validateSubset } from "./openapi/subset-validator";
import { resolveRefs } from "./openapi/ref-resolver";
import { canonicalize, canonicalStringify } from "./openapi/canonicalize";
import { sha256Hash, sha256HashString } from "./hash";
import { buildApiIR } from "./apiir";
import type { ApiIR } from "./apiir";
import { llmPlan } from "./uiplan/llm-plan";
import type { UiPlanIR } from "./uiplan/uiplan.schema";
import { lower } from "./lowering";
import type { UISpec } from "@/lib/spec/types";
import type { CompilerError } from "./errors";
import { slugify } from "@/lib/utils/slugify";

export type CompileSource = "api" | "eval";

export interface CompileOptions {
  source?: CompileSource;
  /** Inject mock for tests (CI without API key). */
  llmPlanFn?: (apiIr: ApiIR) => UiPlanIR;
  /** Session ID from compiler page. When provided, id = hash(openapiHash + sessionId) for unique shareable URLs. */
  sessionId?: string;
}

export interface CompileSuccess {
  success: true;
  id: string;
  specs: Record<string, UISpec>;
  resourceNames: string[];
  resourceSlugs: string[];
  apiIr: ApiIR;
  openapiCanonicalHash: string;
}

export interface CompileFailure {
  success: false;
  errors: CompilerError[];
}

export type CompileOutput = CompileSuccess | CompileFailure;

/**
 * Compile OpenAPI string to UISpec map.
 * id = first 12 chars of openapiCanonicalHash.
 * On failure, returns errors; no persist.
 */
export async function compileOpenAPI(
  openapiString: string,
  options?: CompileOptions
): Promise<CompileOutput> {

  const parseResult = parseOpenAPI(openapiString);
  if (!parseResult.success) {
    return { success: false, errors: [parseResult.error] };
  }

  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) {
    return { success: false, errors: validateResult.errors };
  }

  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) {
    return { success: false, errors: [resolveResult.error] };
  }

  const canonical = canonicalize(resolveResult.doc);
  const canonicalStr = canonicalStringify(canonical);
  const openapiCanonicalHash = sha256Hash(canonicalStr);

  const buildResult = buildApiIR(resolveResult.doc);
  if (!buildResult.success) {
    return { success: false, errors: [buildResult.error] };
  }

  const llmResult = await llmPlan(buildResult.apiIr, {
    source: options?.source ?? "api",
    llmPlanFn: options?.llmPlanFn,
  });
  if (!llmResult.success) {
    return { success: false, errors: [llmResult.error] };
  }

  const lowerResult = lower(llmResult.uiPlan, buildResult.apiIr);
  if (!lowerResult.success) {
    return { success: false, errors: [lowerResult.error] };
  }

  const resourceNames = buildResult.apiIr.resources.map((r) => r.name);
  const resourceSlugs = resourceNames.map(slugify);

  const id = options?.sessionId
    ? sha256HashString(openapiCanonicalHash + options.sessionId).slice(0, 12)
    : openapiCanonicalHash.slice(0, 12);

  return {
    success: true,
    id,
    specs: lowerResult.specs,
    resourceNames,
    resourceSlugs,
    apiIr: buildResult.apiIr,
    openapiCanonicalHash,
  };
}
