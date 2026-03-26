import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  extractArchetypesSmokeCliArgs,
  runExtractArchetypesCli,
} from '../scripts/extract-archetypes';

const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * Ephemeral smoke output — same argv as
 * `npm run extract:archetypes -- --limit 50 --output-dir tests/tmp/extract-archetypes-smoke`.
 *
 * The limit applies after a **global sort** of specIds (`api-guru/…` before `github/…`), so the
 * slice is the first 50 APIs.guru fixtures only. Expect sparse archetypes and console warnings in
 * CI — that is intentional. See docs/pre-phase-6-archetypes.md §9.
 */
const TEST_OUTPUT_DIR = join(__dirname, 'tmp', 'extract-archetypes-smoke');
const ARCHETYPES_JSON = join(TEST_OUTPUT_DIR, 'archetypes.json');
const GOLDEN_CANDIDATES = join(TEST_OUTPUT_DIR, 'reports/golden-candidates.md');

describe('extract-archetypes smoke test', () => {
  beforeAll(() => {
    runExtractArchetypesCli(extractArchetypesSmokeCliArgs(TEST_OUTPUT_DIR));
  });

  it('produces archetypes.json with correct structure', () => {
    expect(existsSync(ARCHETYPES_JSON)).toBe(true);
    const data = JSON.parse(readFileSync(ARCHETYPES_JSON, 'utf-8'));

    expect(data.meta).toBeDefined();
    expect(data.meta.toolVersion).toBe('1.0');
    expect(typeof data.meta.specCount).toBe('number');
    expect(typeof data.meta.resourceCount).toBe('number');
    expect(data.meta.timestamp).toBeDefined();

    expect(data.archetypes).toBeDefined();
    expect(typeof data.archetypes).toBe('object');
    const archKeys = Object.keys(data.archetypes);
    expect(archKeys.length).toBeGreaterThan(0);
    expect(archKeys).toEqual([...archKeys].sort());

    expect(data.specs).toBeDefined();
    expect(Array.isArray(data.specs)).toBe(true);
    if (data.specs.length > 0) {
      const spec = data.specs[0];
      expect(spec.specId).toBeDefined();
      expect(spec.resources).toBeDefined();
      expect(Array.isArray(spec.resources)).toBe(true);
    }
  });

  it('produces golden-candidates.md with 26 section headings (content may be sparse under --limit 50)', () => {
    expect(existsSync(GOLDEN_CANDIDATES)).toBe(true);
    const content = readFileSync(GOLDEN_CANDIDATES, 'utf-8');
    const sections = content.match(/^## \d+\. /gm) ?? [];
    expect(sections.length).toBe(26);
  });
});
