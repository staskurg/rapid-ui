/**
 * List-like operations: {@link OPERATION_KIND.list} and {@link OPERATION_KIND.listScoped}.
 * Used when a single “primary” list op is needed (seeds, archetypes) vs enumerating all list-likes.
 */

import {
  compareOperationKind,
  isListLikeKind,
  type OperationIR,
  type OperationKind,
} from './types';

/** All operations whose kind is list-like, in resource order (matches build / {@link compareOperationKind} sort). */
export function filterListLikeOperations(operations: OperationIR[]): OperationIR[] {
  return operations.filter((o) => isListLikeKind(o.kind));
}

/**
 * First list-like operation in resource order.
 * ApiIR build sorts operations by kind, so **list** precedes **listScoped** when both exist;
 * this is the canonical “primary” for table/list schema when multiple list-likes are present.
 */
export function primaryListLikeOperation(operations: OperationIR[]): OperationIR | undefined {
  return operations.find((o) => isListLikeKind(o.kind));
}

/** Distinct list-like kinds present on the resource, in {@link compareOperationKind} order. */
export function listLikeOperationKinds(operations: OperationIR[]): OperationKind[] {
  return [...new Set(filterListLikeOperations(operations).map((o) => o.kind))].sort(
    compareOperationKind
  );
}
