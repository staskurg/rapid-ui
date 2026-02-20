/**
 * LLM planning: ApiIR → UiPlanIR.
 * Constrained classifier: labels, ordering, readOnly only.
 * Retry max 2 on validation failure.
 */

import { readFileSync } from "fs";
import path from "path";
import type { ApiIR } from "../apiir";
import { apiIrStringify } from "../apiir";
import { getOpenAIClient } from "@/lib/ai/client";
import { recordOpenAICall } from "@/lib/ai/metrics";
import type { OpenAICallSource } from "@/lib/ai/metrics";
import { sha256Hash } from "../hash";
import type { CompilerError } from "../errors";
import { UiPlanIRSchema } from "./uiplan.schema";
import type { UiPlanIR } from "./uiplan.schema";
import { buildUserPrompt } from "./prompt.user";
import { normalizeUiPlanIR } from "./normalize";
import { formatZodError } from "./format-errors";
import { ZodError } from "zod";

const MODEL = "gpt-4o-mini";
const MAX_RETRIES = 2;

export interface LlmPlanResult {
  success: true;
  uiPlan: UiPlanIR;
  uiPlanHash: string;
}

export interface LlmPlanFailure {
  success: false;
  error: CompilerError;
}

export type LlmPlanOutput = LlmPlanResult | LlmPlanFailure;

/**
 * Extract JSON from LLM response. Handles markdown code blocks.
 */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return trimmed;
}

/**
 * Plan UiPlanIR from ApiIR via LLM.
 * Returns UIPLAN_LLM_UNAVAILABLE if OPENAI_API_KEY is not set.
 * Retries up to MAX_RETRIES on Zod validation failure.
 */
export async function llmPlan(
  apiIr: ApiIR,
  options?: { source?: OpenAICallSource; llmPlanFn?: (apiIr: ApiIR) => UiPlanIR }
): Promise<LlmPlanOutput> {
  const source = options?.source ?? "api";

  // Optional mock for tests (CI without API key)
  if (options?.llmPlanFn) {
    const uiPlan = options.llmPlanFn(apiIr);
    const normalized = normalizeUiPlanIR(uiPlan);
    const uiPlanHash = sha256Hash(normalized);
    return { success: true, uiPlan: normalized, uiPlanHash };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: {
        code: "UIPLAN_LLM_UNAVAILABLE",
        stage: "UiPlan",
        message:
          "OPENAI_API_KEY is not set. Add it to .env.local to use LLM planning.",
      },
    };
  }

  const systemPrompt = readFileSync(
    path.join(process.cwd(), "lib/compiler/uiplan/prompt.system.txt"),
    "utf-8"
  );
  const userPrompt = buildUserPrompt(apiIrStringify(apiIr));

  let lastZodError: ZodError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const client = getOpenAIClient();
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 4096,
      });

      promptTokens = completion.usage?.prompt_tokens ?? 0;
      completionTokens = completion.usage?.completion_tokens ?? 0;

      const rawContent = completion.choices[0]?.message?.content;
      if (!rawContent) {
        recordOpenAICall({
          timestamp: new Date().toISOString(),
          model: MODEL,
          duration_ms: Date.now() - start,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          source,
          status: "error",
        });
        return {
          success: false,
          error: {
            code: "UIPLAN_INVALID",
            stage: "UiPlan",
            message: "LLM returned empty response",
          },
        };
      }

      const jsonStr = extractJson(rawContent);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        recordOpenAICall({
          timestamp: new Date().toISOString(),
          model: MODEL,
          duration_ms: Date.now() - start,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          source,
          status: "error",
        });
        return {
          success: false,
          error: {
            code: "UIPLAN_INVALID",
            stage: "UiPlan",
            message: "LLM response is not valid JSON",
          },
        };
      }

      const parseResult = UiPlanIRSchema.safeParse(parsed);
      if (parseResult.success) {
        const normalized = normalizeUiPlanIR(parseResult.data);
        const uiPlanHash = sha256Hash(normalized);

        recordOpenAICall({
          timestamp: new Date().toISOString(),
          model: MODEL,
          duration_ms: Date.now() - start,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          source,
          status: "success",
        });

        return {
          success: true,
          uiPlan: normalized,
          uiPlanHash,
        };
      }

      lastZodError = parseResult.error;
      if (attempt < MAX_RETRIES) {
        continue; // Retry
      }

      const errors = formatZodError(parseResult.error);
      recordOpenAICall({
        timestamp: new Date().toISOString(),
        model: MODEL,
        duration_ms: Date.now() - start,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        source,
        status: "error",
      });

      return {
        success: false,
        error: errors[0] ?? {
          code: "UIPLAN_INVALID",
          stage: "UiPlan",
          message: "UiPlanIR validation failed",
        },
      };
    } catch (err) {
      const duration = Date.now() - start;
      recordOpenAICall({
        timestamp: new Date().toISOString(),
        model: MODEL,
        duration_ms: duration,
        prompt_tokens: 0,
        completion_tokens: 0,
        source,
        status: "error",
      });

      const message =
        err instanceof Error ? err.message : "Unknown LLM error";
      return {
        success: false,
        error: {
          code: "UIPLAN_LLM_UNAVAILABLE",
          stage: "UiPlan",
          message: `LLM call failed: ${message}`,
        },
      };
    }
  }

  // Should not reach here; lastZodError is set when we exhaust retries
  const errors = lastZodError ? formatZodError(lastZodError) : [];
  return {
    success: false,
    error:
      errors[0] ?? ({
        code: "UIPLAN_INVALID" as const,
        stage: "UiPlan" as const,
        message: "UiPlanIR validation failed after retries",
      }),
  };
}
