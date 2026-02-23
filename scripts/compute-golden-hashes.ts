/**
 * One-off script to compute canonical hashes for golden specs.
 * Run: npx tsx scripts/compute-golden-hashes.ts
 *
 * Why we need this: lib/compiler/mock/fixtures.ts hardcodes USERS_HASH and PRODUCTS_HASH
 * so the mock store can match uploaded specs to predefined data. Those hashes come from
 * sha256(canonicalStringify(canonicalize(resolve(doc)))). If you add a new golden spec,
 * change an existing one, or the canonicalizer changes, the hash changes. Run this script,
 * copy the output hashes into fixtures.ts, and the mock store will correctly route to
 * the right predefined JSON.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parseOpenAPI } from "../lib/compiler/openapi/parser";
import { resolveRefs } from "../lib/compiler/openapi/ref-resolver";
import { validateSubset } from "../lib/compiler/openapi/subset-validator";
import { canonicalize, canonicalStringify } from "../lib/compiler/openapi/canonicalize";
import { sha256Hash } from "../lib/compiler/hash";

const FIXTURES = [
  "tests/compiler/fixtures/golden_openapi_users_tagged_3_0.yaml",
  "tests/compiler/fixtures/golden_openapi_products_path_3_1.yaml",
];

for (const p of FIXTURES) {
  const yaml = readFileSync(join(process.cwd(), p), "utf8");
  const parse = parseOpenAPI(yaml);
  if (!parse.success) {
    console.error(p, "parse failed:", parse.error);
    continue;
  }
  const validate = validateSubset(parse.doc);
  if (!validate.success) {
    console.error(p, "validate failed:", validate.errors);
    continue;
  }
  const resolve = resolveRefs(parse.doc);
  if (!resolve.success) {
    console.error(p, "resolve failed:", resolve.error);
    continue;
  }
  const canonical = canonicalize(resolve.doc);
  const str = canonicalStringify(canonical);
  const hash = sha256Hash(str);
  console.log(p.split("/").pop(), "->", hash);
}
