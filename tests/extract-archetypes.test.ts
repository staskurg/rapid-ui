import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const TEST_OUTPUT_DIR = join(__dirname, 'compiler/fixtures/extract-archetypes-output');
const ARCHETYPES_JSON = join(TEST_OUTPUT_DIR, 'archetypes.json');
const GOLDEN_CANDIDATES = join(TEST_OUTPUT_DIR, 'reports/golden-candidates.md');

describe('extract-archetypes smoke test', () => {
  beforeAll(() => {
    execSync(`npm run extract:archetypes -- --limit 50 --output-dir "${TEST_OUTPUT_DIR}"`, {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });
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

  it('produces golden-candidates.md with 22 sections', () => {
    expect(existsSync(GOLDEN_CANDIDATES)).toBe(true);
    const content = readFileSync(GOLDEN_CANDIDATES, 'utf-8');
    const sections = content.match(/^## \d+\. /gm) ?? [];
    expect(sections.length).toBe(22);
  });
});
