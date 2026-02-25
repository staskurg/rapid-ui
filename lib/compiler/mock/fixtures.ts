/**
 * Predefined fixtures for golden and demo specs.
 * Hash matches canonical OpenAPI hash of YAML files.
 *
 * Data source model: Multiple spec hashes can map to the same logical "data source"
 * (e.g. demo v1, v2, v3 all share "demo" data). Data is keyed by accountId + dataSourceId
 * so it persists across spec updates and is shared across compilations of the same spec type.
 */

import usersData from "./fixtures/users.json";
import productsData from "./fixtures/products.json";
import demoUsersData from "./fixtures/demo_users.json";
import demoTasksData from "./fixtures/demo_tasks.json";

// Precomputed hashes from canonicalize(parse(resolve(YAML)))
const USERS_HASH = "5a0ce498f01c4e576298c21e89b97db4d830c42faa9871aca9acbcf2c145f11b";
const PRODUCTS_HASH = "431b8e7977994a9adcbfeed1d88f76b65c430f8717099a75debd3e55ad575db4";
const DEMO_V1_HASH = "f5101f6b8fa05572eb07e515a76de927126abaf34c782e790a824e4349a9ad87";
const DEMO_V2_HASH = "41b2154073b3a1232aed8fc749b27306ae726347a7d95d0abc51e02945c72684";
const DEMO_V3_HASH = "70eb64ab003fe707a5a0f3a3339d0df55a370c1720f3980abed182f18e724976";

/** Maps hash -> logical data source id. Multiple hashes (e.g. demo v1/v2/v3) share one source. */
const HASH_TO_DATA_SOURCE: Record<string, string> = {
  [USERS_HASH]: "golden_users",
  [PRODUCTS_HASH]: "golden_products",
  [DEMO_V1_HASH]: "demo",
  [DEMO_V2_HASH]: "demo",
  [DEMO_V3_HASH]: "demo",
};

/** Data source id -> resourceSlug -> seed data. Used for first-time init per account. */
const DATA_SOURCE_TO_RESOURCE_DATA: Record<string, Record<string, Record<string, unknown>[]>> = {
  golden_users: { users: usersData as Record<string, unknown>[] },
  golden_products: { products: productsData as Record<string, unknown>[] },
  demo: {
    users: demoUsersData as Record<string, unknown>[],
    tasks: demoTasksData as Record<string, unknown>[],
  },
};

const PREDEFINED_HASHES = new Set(Object.keys(HASH_TO_DATA_SOURCE));
const GOLDEN_HASHES = new Set([USERS_HASH, PRODUCTS_HASH]);

export function isGoldenSpec(hash: string): boolean {
  return GOLDEN_HASHES.has(hash);
}

/** True for golden or demo hashes. Used for Phase 4 GET response isPredefined field. */
export function isPredefinedSpec(hash: string): boolean {
  return PREDEFINED_HASHES.has(hash);
}

/**
 * Get logical data source id for a spec hash. Predefined specs (demo v1/v2/v3, golden)
 * share data sources. Custom specs return null (use compilationId as key).
 */
export function getDataSourceId(hash: string): string | null {
  return HASH_TO_DATA_SOURCE[hash] ?? null;
}

/**
 * Get seed data for a data source + resource. Used when initializing per-account store.
 */
export function getPredefinedDataForDataSource(
  dataSourceId: string,
  resourceSlug: string
): Record<string, unknown>[] | null {
  const byResource = DATA_SOURCE_TO_RESOURCE_DATA[dataSourceId];
  if (!byResource) return null;
  const data = byResource[resourceSlug];
  return data ? [...data] : null;
}

/** @deprecated Use getDataSourceId + getPredefinedDataForDataSource. Kept for compatibility. */
export function getPredefinedData(
  hash: string,
  resourceSlug: string
): Record<string, unknown>[] | null {
  const dataSourceId = getDataSourceId(hash);
  if (!dataSourceId) return null;
  return getPredefinedDataForDataSource(dataSourceId, resourceSlug);
}
