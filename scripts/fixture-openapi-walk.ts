/**
 * Discover OpenAPI fixture files under tests/compiler/fixtures (flat or nested).
 * Skips the top-level `apiir` tree (generated output).
 */

import { readdirSync } from 'fs';
import { join } from 'path';

const OPENAPI_EXT = /\.(yaml|yml|json)$/i;

/**
 * Yield relative paths from `fixturesDir` for each `.yaml`, `.yml`, or `.json` file.
 */
export function walkOpenapiFixtureRelPaths(
  fixturesDir: string,
  visitor: (relPath: string) => void
): void {
  function walk(rel: string, depth: number): void {
    const abs = join(fixturesDir, rel);
    const ents = readdirSync(abs, { withFileTypes: true });
    ents.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of ents) {
      if (depth === 0 && ent.name === 'apiir') continue;
      const relChild = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(relChild, depth + 1);
      } else if (ent.isFile() && OPENAPI_EXT.test(ent.name)) {
        visitor(relChild);
      }
    }
  }
  walk('', 0);
}

/** `valid-specs-github/foo.yaml` → `apiir/valid-specs-github/foo.json` */
export function openapiFixtureRelToApiirRel(relOpenapi: string): string {
  const withoutExt = relOpenapi.replace(/\.(yaml|yml|json)$/i, '');
  return `apiir/${withoutExt}.json`;
}
