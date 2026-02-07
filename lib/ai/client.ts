/**
 * OpenAI Client - Initializes and exports OpenAI client instance
 */

import OpenAI from "openai";

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
