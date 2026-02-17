/**
 * Payload guard for AI spec generation.
 * Samples large payloads to stay within token limits and avoid truncation.
 */

/** Max rows to send to AI. Schema can be inferred from a representative sample. */
export const MAX_PAYLOAD_ROWS = 30;

/** Max chars for payload (rough proxy for tokens). Non-array payloads use this. */
export const MAX_PAYLOAD_CHARS = 80_000;

/**
 * Sample payload for AI generation. Prevents oversized prompts that cause:
 * - High input token cost
 * - Output truncation (max_tokens exceeded) → invalid JSON
 */
export function samplePayloadForAI<T>(payload: T): T {
  if (Array.isArray(payload)) {
    if (payload.length <= MAX_PAYLOAD_ROWS) return payload;
    const sampled = payload.slice(0, MAX_PAYLOAD_ROWS);
    console.warn(
      `[generate-ui] Payload sampled: ${payload.length} rows → ${MAX_PAYLOAD_ROWS} rows (keeps prompt within limits)`
    );
    return sampled as T;
  }

  // Non-array: check character size
  const str = JSON.stringify(payload);
  if (str.length <= MAX_PAYLOAD_CHARS) return payload;
  console.warn(
    `[generate-ui] Payload too large: ${str.length} chars (limit ${MAX_PAYLOAD_CHARS}). Consider using a smaller sample.`
  );
  return payload; // Still pass through; AI may succeed or fallback will handle
}
