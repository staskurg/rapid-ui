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
  ParameterIR,
  ParameterIn,
} from './types';
export {
  CURRENT_API_IR_VERSION,
  HTTP_METHOD,
  isListLikeKind,
  OPERATION_KIND,
  OPERATION_KIND_ORDER,
  OPERATION_KIND_REPORT_ORDER,
  PARAMETER_IN,
} from './types';
export { buildApiIR, apiIrStringify } from './build';
export type { BuildApiIROutput, BuildApiIRResult, BuildApiIRFailure } from './build';
