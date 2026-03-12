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
  Capabilities,
} from "./types";
export { deriveCapabilities, deriveCapabilitiesForResource } from "./capabilities";
export { buildApiIR, apiIrStringify } from "./build";
export type { BuildApiIROutput, BuildApiIRResult, BuildApiIRFailure } from "./build";
