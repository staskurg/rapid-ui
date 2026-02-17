/**
 * OpenAI Client - Initializes and exports OpenAI client instance
 */

import OpenAI from "openai";

/** Request timeout in ms. 2 min for complex payloads; override via OPENAI_TIMEOUT_MS env. */
const REQUEST_TIMEOUT_MS =
  typeof process.env.OPENAI_TIMEOUT_MS === "string"
    ? parseInt(process.env.OPENAI_TIMEOUT_MS, 10)
    : 120_000;

/**
 * Get OpenAI API key from environment variables
 */
function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please add it to your .env.local file."
    );
  }
  
  return apiKey;
}

/**
 * Initialize OpenAI client
 * Throws error if API key is not configured
 */
let clientInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!clientInstance) {
    try {
      const apiKey = getApiKey();
      clientInstance = new OpenAI({
        apiKey,
        timeout: REQUEST_TIMEOUT_MS,
      });
    } catch (error) {
      throw error;
    }
  }
  
  return clientInstance;
}

/**
 * Check if OpenAI API key is configured
 * Useful for conditional UI rendering
 */
export function isOpenAIConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}
