/**
 * @deprecated Legacy payload-based eval. Replaced by OpenAPI pipeline in Phase 7.
 * See eval/utils/compile-openapi.ts
 */

export type GenerateSpecResult = {
  spec: Record<string, unknown>;
  rawResponse: unknown;
  source: string;
};

export async function generateSpecWithAI(
  _payload: Record<string, unknown>[],
  _intent?: string
): Promise<GenerateSpecResult> {
  throw new Error(
    "Legacy AI generator removed. Use OpenAPI pipeline (eval/utils/compile-openapi.ts) in Phase 7."
  );
}
