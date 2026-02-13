/**
 * Session management for demo API.
 * Session ID in React state only — no localStorage. Reload = fresh start.
 */

export function createSessionId(): string {
  return crypto.randomUUID();
}
