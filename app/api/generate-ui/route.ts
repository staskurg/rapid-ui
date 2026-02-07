/**
 * API Route: Generate UI Spec from Payload using AI
 * POST /api/generate-ui
 */

import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/client";
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
 */
async function generateSpecWithAI(
  payload: unknown,
  intent?: string,
  existingSpec?: UISpec,
  retryCount = 0,
  previousError?: string
): Promise<UISpec> {
  const client = getOpenAIClient();
  let userPrompt = buildUserPrompt(payload, intent, existingSpec);
  
  // Enhance prompt on retry with validation error feedback
  if (retryCount > 0 && previousError) {
    userPrompt += `\n\nIMPORTANT: The previous response failed validation (${previousError}). Please ensure:
- All field references in table.columns, form.fields, and filters exist in the fields array
- Enum fields have an options array
- The response is valid JSON matching the exact schema
- No markdown formatting, just pure JSON`;
  }
  
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini for cost efficiency
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" }, // Request JSON response
      temperature: 0.3, // Lower temperature for more deterministic output
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }
    
    // Validate the response
    try {
      return validateAISpec(content);
    } catch (validationError) {
      // If validation fails and we have retries left, retry with adjusted prompt
      if (retryCount < MAX_RETRIES) {
        const errorMessage = validationError instanceof Error 
          ? validationError.message 
          : String(validationError);
        console.warn(
          `AI response validation failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`,
          errorMessage
        );
        
        // Retry with enhanced prompt
        return generateSpecWithAI(
          payload, 
          intent, 
          existingSpec, 
          retryCount + 1,
          errorMessage
        );
      }
      
      // Out of retries, throw the validation error
      throw validationError;
    }
  } catch (error) {
    // If it's a validation error and we're out of retries, throw it
    if (error instanceof Error && error.message.includes("validation")) {
      throw error;
    }
    
    // For other errors (API errors, network errors, etc.), throw them
    throw error;
  }
}

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        {
          error: "Invalid request body. Expected valid JSON.",
          details: jsonError instanceof Error ? jsonError.message : String(jsonError),
        },
        { status: 400 }
      );
    }
    
    const { payload, intent, existingSpec } = body;
    
    // Validate request body
    if (payload === undefined) {
      return NextResponse.json(
        { error: "Missing required field: payload" },
        { status: 400 }
      );
    }
    
    let spec: UISpec;
    let source: "ai" | "fallback" = "ai";
    
    try {
      // Try AI generation first
      spec = await generateSpecWithAI(payload, intent, existingSpec);
    } catch (aiError) {
      console.error("AI generation failed, using fallback:", aiError);
      
      // Use fallback generator
      try {
        spec = generateFallbackSpec(payload);
        source = "fallback";
      } catch (fallbackError) {
        console.error("Fallback generator also failed:", fallbackError);
        return NextResponse.json(
          {
            error: "Failed to generate UI spec. Both AI and fallback methods failed.",
            details: aiError instanceof Error ? aiError.message : String(aiError),
          },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({
      spec,
      source,
    });
  } catch (error) {
    console.error("API route error:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error instanceof Error) {
        if (error.message.includes("OPENAI_API_KEY")) {
          return NextResponse.json(
            {
              error: "OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env.local file.",
            },
            { status: 500 }
          );
        }
      }
    }
    
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
