/**
 * ApiIR — OpenAPI to semantic IR.
 */

export type {
  ApiIR,
  ResourceIR,
  OperationIR,
  OperationKind,
  HttpMethod,
  JsonSchema,
} from "./types";
export { buildApiIR, apiIrStringify } from "./build";
export type { BuildApiIROutput, BuildApiIRResult, BuildApiIRFailure } from "./build";
