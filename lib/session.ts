/**
 * Session management for demo API.
 * accountId persisted in localStorage for multi-compilation listing.
 */

const ACCOUNT_ID_KEY = "rapidui_account_id";

/**
 * Get or create a persistent account ID. Reads from localStorage;
 * if missing, generates a UUID and persists it.
 * Must be called in browser (uses localStorage).
 */
export function getOrCreateAccountId(): string {
  if (typeof window === "undefined") {
    throw new Error("getOrCreateAccountId requires browser environment");
  }
  let id = localStorage.getItem(ACCOUNT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ACCOUNT_ID_KEY, id);
  }
  return id;
}
