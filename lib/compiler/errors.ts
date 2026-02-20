/**
 * Compiler error taxonomy for OpenAPI → UISpec pipeline.
 * Structured errors with code, stage, message, and optional jsonPointer.
 */

export type CompilerStage =
  | "Parse"
  | "Subset"
  | "Canonicalize"
  | "ApiIR"
  | "UiPlan"
  | "Lowering";

export type CompilerErrorCode =
  | "OAS_PARSE_ERROR"
  | "OAS_UNSUPPORTED_SCHEMA_KEYWORD"
  | "OAS_MULTIPLE_SUCCESS_RESPONSES"
  | "OAS_MULTIPLE_TAGS"
  | "OAS_MISSING_REQUEST_BODY"
  | "OAS_MULTIPLE_PATH_PARAMS"
  | "OAS_EXTERNAL_REF"
  | "OAS_CIRCULAR_REF"
  | "OAS_AMBIGUOUS_RESOURCE_GROUPING"
  | "IR_INVALID"
  | "UIPLAN_INVALID"
  | "UIPLAN_LLM_UNAVAILABLE"
  | "UISPEC_INVALID";

export interface CompilerError {
  code: CompilerErrorCode;
  stage: CompilerStage;
  message: string;
  jsonPointer?: string;
}

export function createError(
  code: CompilerErrorCode,
  stage: CompilerStage,
  message: string,
  jsonPointer?: string
): CompilerError {
  return { code, stage, message, ...(jsonPointer && { jsonPointer }) };
}
