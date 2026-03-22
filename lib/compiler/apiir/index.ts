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
  compareOperationKind,
  CURRENT_API_IR_VERSION,
  HTTP_METHOD,
  isListLikeKind,
  OPERATION_KIND,
  OPERATION_KIND_ORDER,
  OPERATION_KIND_REPORT_ORDER,
  operationKindRank,
  PARAMETER_IN,
} from './types';
export { buildApiIR, apiIrStringify } from './build';
export type { BuildApiIROutput, BuildApiIRResult, BuildApiIRFailure } from './build';
export {
  classifyListResponseEnvelope,
  isArrayRootSchema,
  isListShapedResponseSchema,
  JSON_SCHEMA_TYPE,
  LIST_ENVELOPE_INNER_KEY,
  LIST_ENVELOPE_INNER_KEY_ORDER,
  LIST_ENVELOPE_LABEL,
  LIST_ENVELOPE_OUTER_KEY,
  LIST_ENVELOPE_OUTER_KEY_ORDER,
  schemaHasJsonType,
} from './list-shape';
export type { JsonSchemaTypeKeyword } from './list-shape';
export {
  filterListLikeOperations,
  listLikeOperationKinds,
  primaryListLikeOperation,
} from './list-like';
