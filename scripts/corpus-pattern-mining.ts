#!/usr/bin/env tsx
/**
 * Standalone structural pattern mining on ApiIR fixtures.
 * Reads ApiIR JSON from tests/compiler/fixtures/apiir/valid-specs-{repo}/ (or path arg).
 * With --repo: auto-saves to scripts/corpus-data/reports/pattern-mining-{repo}-{timestamp}.md
 *
 * RUS-v1 acceptance rate is derived from raw corpus run output (raw-{repo}-*.json in
 * scripts/corpus-data/reports/). Run corpus:run first to produce raw output.
 *
 * Usage: npm run corpus:pattern-mining -- --repo REPO [--output PATH] [--debug]
 *   or:  npm run corpus:pattern-mining [path-to-apiir-dir]
 *   REPO: api-guru | github
 *   --debug: include pattern examples in report
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import type { ApiIR } from '@/lib/compiler/apiir';
import { mineComprehensive, formatComprehensiveReport } from './corpus-data/analyze-apiir';

const FIXTURES_APIIR = join(process.cwd(), 'tests/compiler/fixtures/apiir');
const REPORTS_DIR = join(process.cwd(), 'scripts/corpus-data/reports');

interface RawCorpusResult {
  valid: boolean;
  parseFailed?: boolean;
  crashed?: boolean;
}

interface RawCorpusOutput {
  meta?: { batch?: unknown; timestamp?: string };
  results: RawCorpusResult[];
}

/** Derive RUS-v1 acceptance rate from latest raw corpus run output. */
function loadAcceptanceRate(
  repo: string
): { valid: number; total: number; corpusLabel: string } | undefined {
  if (!existsSync(REPORTS_DIR)) return undefined;
  const prefix = `raw-${repo}-`;
  const files = readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.json') && f.startsWith(prefix))
    .sort((a, b) => b.localeCompare(a));
  if (files.length === 0) return undefined;
  try {
    const data = JSON.parse(readFileSync(join(REPORTS_DIR, files[0]!), 'utf-8')) as RawCorpusOutput;
    const results = data.results ?? [];
    const total = results.length;
    if (total === 0) return undefined;
    const valid = results.filter((r) => r.valid && !r.parseFailed && !r.crashed).length;
    const label = repo === 'api-guru' ? 'API-Guru corpus' : 'GitHub corpus';
    return { valid, total, corpusLabel: label };
  } catch {
    return undefined;
  }
}

function main(): number {
  const args = process.argv.slice(2);
  let dirArg: string | null = null;
  let outputPath: string | null = null;
  let repo: string | null = null;
  let debug = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) {
      repo = args[++i];
    } else if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      outputPath = args[++i];
    } else if (args[i] === '--debug') {
      debug = true;
    } else if (!args[i].startsWith('-')) {
      dirArg = args[i];
    }
  }

  let dir: string;
  if (dirArg) {
    dir = dirArg.startsWith('/') ? dirArg : join(process.cwd(), dirArg);
  } else if (repo === 'api-guru' || repo === 'github') {
    dir = join(FIXTURES_APIIR, `valid-specs-${repo}`);
  } else {
    dir = join(FIXTURES_APIIR, 'valid-specs-api-guru'); // default
  }

  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return 1;
  }

  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const entries: Array<{ apiIr: ApiIR; specPath: string }> = [];

  for (const file of files) {
    const filePath = join(dir, file);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`Failed to read ${file}: ${err}`);
      continue;
    }

    let apiIr: ApiIR;
    try {
      apiIr = JSON.parse(content) as ApiIR;
    } catch (err) {
      console.error(`Failed to parse ${file}: ${err}`);
      continue;
    }

    entries.push({ apiIr, specPath: filePath });
  }

  if (entries.length === 0) {
    console.error(`No ApiIR JSON files found in ${dir}`);
    return 1;
  }

  const agg = mineComprehensive(entries);
  const acceptanceRate = repo ? loadAcceptanceRate(repo) : undefined;
  const lines = formatComprehensiveReport(agg, {
    includeExamples: debug,
    acceptanceRate,
  });
  const reportContent = lines.join('\n');

  let savePath: string | null = outputPath;
  if (!savePath && (repo === 'api-guru' || repo === 'github')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    savePath = `scripts/corpus-data/reports/pattern-mining-${repo}-${timestamp}.md`;
  }

  if (savePath) {
    const absPath = join(process.cwd(), savePath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, reportContent, 'utf-8');
    console.log(`Report written to: ${absPath}`);
  } else {
    console.log(reportContent);
  }

  return 0;
}

process.exit(main());
