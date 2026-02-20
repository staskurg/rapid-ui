/**
 * Format Zod validation errors into compiler error format.
 */

import type { ZodError } from "zod";
import type { CompilerError } from "../errors";

/**
 * Convert Zod error to structured compiler errors.
 */
export function formatZodError(err: ZodError): CompilerError[] {
  return err.issues.map((i) => ({
    code: "UIPLAN_INVALID" as const,
    stage: "UiPlan" as const,
    jsonPointer: "/" + i.path.map(String).join("/"),
    message: i.message,
  }));
}
