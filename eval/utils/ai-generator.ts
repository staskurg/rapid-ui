/**
 * AI generation utility for evaluation harness
 * Directly calls OpenAI API without going through Next.js API route
 */

import { getOpenAIClient } from "@/lib/ai/client";
import { recordOpenAICall } from "@/lib/ai/metrics";
import { samplePayloadForAI } from "@/lib/ai/payload-guard";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompt";
import { UISpecSchema, type UISpec } from "@/lib/spec/schema";
import { generateFallbackSpec } from "@/lib/inference/fallback-generator";

const MAX_RETRIES = 2;

/**
 * Extract JSON from AI response (handles markdown code blocks)
 */
function extractJsonFromResponse(response: string): unknown {
  // Try to parse as-is first
  try {
    return JSON.parse(response.trim());
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through to error
      }
    }

    // Try to find JSON object in the response
    const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]);
      } catch {
        // Fall through to error
      }
    }

    throw new Error("Could not extract valid JSON from AI response");
  }
}

/**
 * Validate and parse AI response into UISpec
 */
function validateAISpec(aiResponse: string): UISpec {
  const parsed = extractJsonFromResponse(aiResponse);
  return UISpecSchema.parse(parsed);
}

/**
 * Call OpenAI API to generate UI spec
 * Returns both the spec and the raw response for evaluation
 */
export async function generateSpecWithAI(
  payload: unknown,
  intent?: string,
  existingSpec?: UISpec,
  retryCount = 0,
  previousError?: string
): Promise<{ spec: UISpec; rawResponse: string; source: "ai" | "fallback" }> {
  const client = getOpenAIClient();
  const sampledPayload = samplePayloadForAI(payload);
  let userPrompt = buildUserPrompt(sampledPayload, intent, existingSpec);

  // Enhance prompt on retry with validation error feedback
  if (retryCount > 0 && previousError) {
    userPrompt += `\n\nIMPORTANT: The previous response failed validation (${previousError}). Please ensure:
- All field references in table.columns, form.fields, and filters exist in the fields array
- Enum fields have an options array
- The response is valid JSON matching the exact schema
- No markdown formatting, just pure JSON`;
  }

  const model = "gpt-4o-mini";
  const openaiStart = performance.now();
  try {
    const completion = await client.chat.completions.create({
      model, // Using gpt-4o-mini for cost efficiency
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" }, // Request JSON response
      temperature: 0.3, // Lower temperature for more deterministic output
      max_tokens: 2048, // Room for complex schemas; 1024 caused truncation on large payloads
    });
    const openaiMs = performance.now() - openaiStart;
    const usage = completion.usage;
    recordOpenAICall({
      timestamp: new Date().toISOString(),
      model,
      duration_ms: Math.round(openaiMs),
      prompt_tokens: usage?.prompt_tokens ?? 0,
      completion_tokens: usage?.completion_tokens ?? 0,
      source: "eval",
      status: "success",
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Validate the response
    try {
      const spec = validateAISpec(content);
      return { spec, rawResponse: content, source: "ai" };
    } catch (validationError) {
      // If validation fails and we have retries left, retry with adjusted prompt
      if (retryCount < MAX_RETRIES) {
        const errorMessage =
          validationError instanceof Error
            ? validationError.message
            : String(validationError);
        console.warn(
          `AI response validation failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`,
          errorMessage
        );

        // Retry with enhanced prompt
        return generateSpecWithAI(
          sampledPayload,
          intent,
          existingSpec,
          retryCount + 1,
          errorMessage
        );
      }

      // Out of retries, use fallback
      console.warn("AI generation failed after retries, using fallback");
      const fallbackSpec = generateFallbackSpec(sampledPayload);
      return {
        spec: fallbackSpec,
        rawResponse: content, // Keep the failed response for analysis
        source: "fallback",
      };
    }
  } catch (error) {
    // Record API/network failure (validation failures are recorded as success above)
    const openaiMs = performance.now() - openaiStart;
    recordOpenAICall({
      timestamp: new Date().toISOString(),
      model,
      duration_ms: Math.round(openaiMs),
      prompt_tokens: 0,
      completion_tokens: 0,
      source: "eval",
      status: "error",
    });
    // For API errors, network errors, etc., use fallback
    console.warn("AI generation error, using fallback:", error);
    const fallbackSpec = generateFallbackSpec(sampledPayload);
    return {
      spec: fallbackSpec,
      rawResponse: error instanceof Error ? error.message : String(error),
      source: "fallback",
    };
  }
}
