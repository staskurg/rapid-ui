/**
 * OpenAPI pipeline caller for evals.
 * Uses source: "eval", no llmPlanFn (evals always use real LLM).
 * Wraps with retry (429/503 → retry once, 2s backoff) and per-run timeout (60s).
 */

import {
  compileOpenAPI,
  type CompileOutput,
  type CompileFailure,
} from "@/lib/compiler/pipeline";

const RUN_TIMEOUT_MS = 60_000;
const RETRY_BACKOFF_MS = 2_000;

function isRetryableError(errors: { message: string }[]): boolean {
  const msg = errors.map((e) => e.message).join(" ").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded")
  );
}

/**
 * Compile OpenAPI string via full pipeline.
 * - source: "eval" (for metrics)
 * - No llmPlanFn — evals always use real LLM
 * - Retry once on 429/503 with 2s backoff (validation failure = no retry)
 * - Per-run timeout 60s; timeout counts as invalid run
 */
export async function compileOpenAPIForEval(
  openapiString: string
): Promise<CompileOutput> {
  const run = (): Promise<CompileOutput> =>
    new Promise((resolve, reject) => {
      compileOpenAPI(openapiString, { source: "eval" })
        .then(resolve)
        .catch(reject);
    });

  const withTimeout = (): Promise<CompileOutput> =>
    Promise.race([
      run(),
      new Promise<CompileFailure>((resolve) =>
        setTimeout(
          () =>
            resolve({
              success: false,
              errors: [
                {
                  code: "UIPLAN_LLM_UNAVAILABLE",
                  stage: "UiPlan",
                  message: "Eval run timed out (60s)",
                },
              ],
            }),
          RUN_TIMEOUT_MS
        )
      ),
    ]);

  const result = await withTimeout();

  if (result.success) {
    return result;
  }

  // Validation failure = no retry
  const isValidationFailure =
    result.errors.some(
      (e) =>
        e.code === "UIPLAN_INVALID" ||
        e.code === "OAS_PARSE_ERROR" ||
        e.code === "OAS_UNSUPPORTED_SCHEMA_KEYWORD" ||
        e.code === "OAS_MULTIPLE_SUCCESS_RESPONSES" ||
        e.code === "OAS_MULTIPLE_TAGS" ||
        e.code === "OAS_MISSING_REQUEST_BODY" ||
        e.code === "OAS_MULTIPLE_PATH_PARAMS" ||
        e.code === "OAS_EXTERNAL_REF" ||
        e.code === "OAS_AMBIGUOUS_RESOURCE_GROUPING" ||
        e.code === "IR_INVALID" ||
        e.code === "UISPEC_INVALID"
    ) || result.errors.some((e) => e.message.includes("timed out"));

  if (isValidationFailure || !isRetryableError(result.errors)) {
    return result;
  }

  // Retry once with backoff
  await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
  return withTimeout();
}
