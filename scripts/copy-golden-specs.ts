#!/usr/bin/env tsx
/**
 * Copy OpenAPI files for golden archetype candidates into
 * tests/compiler/fixtures/golden-candidates/<archetype>/, using paths from
 * golden-candidates.md (same format as extract-archetypes report).
 *
 * Sources: tests/compiler/fixtures/valid-specs-github|valid-specs-api-guru
 *
 * Usage: npm run fixtures:copy-golden-specs
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { GOLDEN_CANDIDATES_DIR, GOLDEN_CANDIDATES_FIXTURE_PATH } from './extract-archetypes';

const FIXTURES_DIR = join(process.cwd(), 'tests/compiler/fixtures');

function corpusToValidSpecsDir(corpus: string): string | null {
  if (corpus === 'github') return join(FIXTURES_DIR, 'valid-specs-github');
  if (corpus === 'api-guru') return join(FIXTURES_DIR, 'valid-specs-api-guru');
  return null;
}

function findSourceFile(validSpecsDir: string, baseName: string): string | null {
  for (const ext of ['.yaml', '.yml', '.json']) {
    const p = join(validSpecsDir, `${baseName}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function parseReport(content: string): Array<{ archetype: string; specId: string }> {
  const entries: Array<{ archetype: string; specId: string }> = [];
  let currentArch: string | null = null;
  for (const line of content.split('\n')) {
    const archm = line.match(/^## \d+\. (.+)$/);
    if (archm) {
      currentArch = archm[1]!.trim();
      continue;
    }
    if (!currentArch || line.startsWith('#')) continue;
    const candm = line.match(/^- (\S+)\s+\(/);
    if (candm) {
      entries.push({ archetype: currentArch, specId: candm[1]! });
    }
  }
  return entries;
}

function main(): number {
  if (!existsSync(GOLDEN_CANDIDATES_FIXTURE_PATH)) {
    console.error(`Missing ${GOLDEN_CANDIDATES_FIXTURE_PATH}`);
    return 1;
  }

  const text = readFileSync(GOLDEN_CANDIDATES_FIXTURE_PATH, 'utf-8');
  const rows = parseReport(text);
  let copied = 0;
  let failed = 0;

  for (const { archetype, specId } of rows) {
    const slash = specId.indexOf('/');
    if (slash < 0) {
      console.error(`Bad specId (no corpus): ${specId}`);
      failed++;
      continue;
    }
    const corpus = specId.slice(0, slash);
    const baseName = specId.slice(slash + 1);
    const validDir = corpusToValidSpecsDir(corpus);
    if (!validDir) {
      console.error(`Unknown corpus in ${specId}`);
      failed++;
      continue;
    }
    const src = findSourceFile(validDir, baseName);
    if (!src) {
      console.error(`Source not found for ${specId} (expected under ${validDir})`);
      failed++;
      continue;
    }
    const destDir = join(GOLDEN_CANDIDATES_DIR, archetype);
    mkdirSync(destDir, { recursive: true });
    const dest = join(destDir, basename(src));
    copyFileSync(src, dest);
    console.log(`Copied ${specId} → ${dest}`);
    copied++;
  }

  console.log(`Done. ${copied} file(s) copied.${failed ? ` ${failed} error(s).` : ''}`);
  return failed > 0 ? 1 : 0;
}

process.exit(main());
