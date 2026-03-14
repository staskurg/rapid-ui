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
export {
  deriveIdentityFields,
  type DeriveIdentityFieldsOutput,
  type DeriveIdentityFieldsResult,
  type DeriveIdentityFieldsFailure,
} from "./identity";
export { buildApiIR, apiIrStringify } from "./build";
export type { BuildApiIROutput, BuildApiIRResult, BuildApiIRFailure } from "./build";
