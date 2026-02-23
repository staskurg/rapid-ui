/**
 * Deterministic hashing for compiler outputs.
 * Uses sha256 of stable JSON stringify.
 */

import { createHash } from "crypto";
import stringify from "fast-json-stable-stringify";

/**
 * Compute sha256 hash of canonical JSON representation.
 * Same input → same hash.
 */
export function sha256Hash(obj: unknown): string {
  const json = stringify(obj);
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * Hash a string with sha256. Used for id = hash(openapiHash + sessionId).
 */
export function sha256HashString(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
