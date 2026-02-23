/**
 * Predefined fixtures for golden specs only.
 * Hash matches canonical OpenAPI hash of golden YAML files.
 */

import usersData from "./fixtures/users.json";
import productsData from "./fixtures/products.json";

// Precomputed hashes from canonicalize(parse(resolve(golden YAML)))
const USERS_HASH = "5a0ce498f01c4e576298c21e89b97db4d830c42faa9871aca9acbcf2c145f11b";
const PRODUCTS_HASH = "431b8e7977994a9adcbfeed1d88f76b65c430f8717099a75debd3e55ad575db4";

const HASH_TO_DATA: Record<string, Record<string, unknown>[]> = {
  [USERS_HASH]: usersData as Record<string, unknown>[],
  [PRODUCTS_HASH]: productsData as Record<string, unknown>[],
};

export function isGoldenSpec(hash: string): boolean {
  return hash in HASH_TO_DATA;
}

export function getPredefinedData(
  hash: string,
  resourceSlug: string
): Record<string, unknown>[] | null {
  const expectedResource = hash === USERS_HASH ? "users" : hash === PRODUCTS_HASH ? "products" : null;
  if (!expectedResource || expectedResource !== resourceSlug) return null;

  const data = HASH_TO_DATA[hash];
  return data ? [...data] : null;
}
