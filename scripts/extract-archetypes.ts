#!/usr/bin/env tsx
/**
 * Extract archetypes from ApiIR fixtures.
 * Loads from tests/compiler/fixtures/apiir/valid-specs-{github|api-guru}/*.json,
 * runs two-pass pipeline (metrics → classification), writes archetypes.json.
 *
 * Default (no `--output-dir`): writes `archetypes.json` under `scripts/corpus-data/` and
 * `golden-candidates/golden-candidates.md` under `tests/compiler/fixtures/` (committed golden list).
 * `scripts/corpus-data/reports/` is reserved for corpus pipeline outputs only.
 *
 * Usage: npm run extract:archetypes [-- --limit N] [--repo github|api-guru] [--output-dir PATH] [--write-json] [--write-report] [--verbose] [--show-archetype NAME]
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiIR } from '@/lib/compiler/apiir';
import {
  extractResourceMetrics,
  aggregateSpecMetrics,
  computeSpecComplexityScore,
  classifyResourceArchetypes,
  classifySpecArchetypes,
  ARCHETYPE_ORDER,
  type ResourceArchetypeMetrics,
  type SpecArchetypeMetrics,
} from './corpus-data/archetype-extractor';

const FIXTURES_APIIR = join(process.cwd(), 'tests/compiler/fixtures/apiir');
/** Default `--output-dir`; only `archetypes.json` is written here — not the golden report (see {@link GOLDEN_CANDIDATES_FIXTURE_PATH}). */
export const EXTRACT_ARCHETYPES_DEFAULT_OUTPUT_DIR = join(process.cwd(), 'scripts/corpus-data');
/** Root for golden candidate artifacts (report + `<archetype>/` OpenAPI pins from copy-golden-specs). */
export const GOLDEN_CANDIDATES_DIR = join(
  process.cwd(),
  'tests/compiler/fixtures/golden-candidates'
);
/** Committed golden spec list (regression / Phase 6 pins); written on default extract when `--write-report` is true. */
export const GOLDEN_CANDIDATES_FIXTURE_PATH = join(GOLDEN_CANDIDATES_DIR, 'golden-candidates.md');

const DEFAULT_OUTPUT_DIR = EXTRACT_ARCHETYPES_DEFAULT_OUTPUT_DIR;

interface LoadedSpec {
  specId: string;
  corpus: 'github' | 'api-guru';
  apiIr: ApiIR;
}

type Candidate = Readonly<{
  specId: string;
  resourceKey: string;
  archetype: string;
  score: number;
  fieldCount: number;
  arrayOfObjectsCount: number;
  resourceCount: number;
}>;

function parseArgs(argv: string[]): {
  limit: number | null;
  repo: 'github' | 'api-guru' | null;
  outputDir: string;
  writeJson: boolean;
  writeReport: boolean;
  verbose: boolean;
  showArchetype: string | null;
} {
  const args = argv;
  let limit: number | null = null;
  let repo: 'github' | 'api-guru' | null = null;
  let outputDir = DEFAULT_OUTPUT_DIR;
  let writeJson = true;
  let writeReport = true;
  let verbose = false;
  let showArchetype: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i]!, 10);
    } else if (args[i] === '--repo' && args[i + 1]) {
      const r = args[++i]!;
      if (r === 'github' || r === 'api-guru') repo = r;
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      outputDir = args[++i]!;
    } else if (args[i] === '--write-json' && args[i + 1] === 'false') {
      writeJson = false;
      i++;
    } else if (args[i] === '--write-report' && args[i + 1] === 'false') {
      writeReport = false;
      i++;
    } else if (args[i] === '--verbose') {
      verbose = true;
    } else if (args[i] === '--show-archetype' && args[i + 1]) {
      showArchetype = args[++i]!;
    }
  }
  return { limit, repo, outputDir, writeJson, writeReport, verbose, showArchetype };
}

function loadSpecs(limit: number | null, repo: 'github' | 'api-guru' | null): LoadedSpec[] {
  const corpora: Array<{ corpus: 'github' | 'api-guru'; dir: string }> = [];
  if (repo === null) {
    corpora.push({ corpus: 'github', dir: join(FIXTURES_APIIR, 'valid-specs-github') });
    corpora.push({ corpus: 'api-guru', dir: join(FIXTURES_APIIR, 'valid-specs-api-guru') });
  } else {
    corpora.push({ corpus: repo, dir: join(FIXTURES_APIIR, `valid-specs-${repo}`) });
  }

  const all: LoadedSpec[] = [];
  for (const { corpus, dir } of corpora) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    for (const file of files) {
      const baseName = file.replace(/\.json$/i, '');
      const specId = `${corpus}/${baseName}`;
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        const apiIr = JSON.parse(content) as ApiIR;
        all.push({ specId, corpus, apiIr });
      } catch {
        // Skip invalid JSON
      }
    }
  }

  const sorted = all.sort((a, b) => a.specId.localeCompare(b.specId));
  return limit !== null ? sorted.slice(0, limit) : sorted;
}

/**
 * Run archetype extraction with the same argv shape as the CLI (`--limit`, `--output-dir`, …).
 * Exported for tests so vitest does not need to spawn `tsx` (IPC can fail in restricted sandboxes).
 */
export function runExtractArchetypesCli(argv: string[]): number {
  return runExtractArchetypesImpl(parseArgs(argv));
}

const SMOKE_LIMIT = 50;

/**
 * CLI argv for smoke extraction — equivalent to
 * `npm run extract:archetypes -- --limit 50 --output-dir <outputDir>`.
 */
export function extractArchetypesSmokeCliArgs(outputDir: string): string[] {
  return ['--limit', String(SMOKE_LIMIT), '--output-dir', outputDir];
}

function main(): number {
  return runExtractArchetypesImpl(parseArgs(process.argv.slice(2)));
}

function runExtractArchetypesImpl(parsed: ReturnType<typeof parseArgs>): number {
  const { limit, repo, outputDir, writeJson, writeReport, verbose, showArchetype } = parsed;
  const outputJsonPath = join(outputDir, 'archetypes.json');
  const isDefaultCorpusOutputDir = resolve(outputDir) === resolve(DEFAULT_OUTPUT_DIR);
  const goldenCandidatesPath = isDefaultCorpusOutputDir
    ? GOLDEN_CANDIDATES_FIXTURE_PATH
    : join(outputDir, 'reports', 'golden-candidates.md');
  const specs = loadSpecs(limit, repo);

  const githubCount = specs.filter((s) => s.corpus === 'github').length;
  const apiGuruCount = specs.filter((s) => s.corpus === 'api-guru').length;
  console.log(`Loaded ${specs.length} specs (github: ${githubCount}, api-guru: ${apiGuruCount})`);

  const resourceCount = specs.reduce((sum, s) => sum + (s.apiIr.resources ?? []).length, 0);
  if (specs.length === 0 || resourceCount === 0) {
    throw new Error('No ApiIR fixtures found. Run fixtures:generate-apiir.');
  }

  // Pass 1: extract metrics
  type SpecData = {
    specId: string;
    corpus: 'github' | 'api-guru';
    specMetrics: SpecArchetypeMetrics;
    resourceMetrics: Array<{
      resource: { name: string; key: string };
      metrics: ResourceArchetypeMetrics;
    }>;
  };

  const pass1: SpecData[] = [];
  for (let i = 0; i < specs.length; i++) {
    const { specId, corpus, apiIr } = specs[i]!;
    if (verbose) {
      console.log(`[${i + 1}/${specs.length}] ${specId}`);
    }
    const resources = apiIr.resources ?? [];
    const resourceMetrics = resources
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((resource) => ({
        resource: { name: resource.name, key: resource.key },
        metrics: extractResourceMetrics(resource),
      }));
    const specMetrics = aggregateSpecMetrics(resourceMetrics.map((r) => r.metrics));
    pass1.push({ specId, corpus, specMetrics, resourceMetrics });
  }

  // Pass 2: classify
  const archetypeIndex = new Map<string, Set<string>>();
  for (const arch of ARCHETYPE_ORDER) {
    archetypeIndex.set(arch, new Set());
  }

  const outputSpecs: Array<{
    specId: string;
    corpus: string;
    resourceCount: number;
    operationCount: number;
    maxFieldsPerResource: number;
    maxDepth: number;
    maxArrayOfObjects: number;
    specComplexityScore: number;
    resources: Array<{
      resourceName: string;
      resourceKey: string;
      fieldCount: number;
      operationCount: number;
      operationPattern: string;
      maxDepth: number;
      enums: number;
      arrayOfObjects: number;
      maps: number;
      nullable: number;
      primitiveOnly: boolean;
      responseShape: string;
      archetypes: string[];
    }>;
  }> = [];

  for (const { specId, corpus, specMetrics, resourceMetrics } of pass1) {
    const specArchetypes = classifySpecArchetypes(
      specMetrics,
      resourceMetrics.map((r) => r.metrics)
    );
    for (const arch of specArchetypes) {
      archetypeIndex.get(arch)?.add(specId);
    }

    const resources = resourceMetrics.map(({ resource, metrics }) => {
      const resourceArchetypes = classifyResourceArchetypes(metrics, specMetrics);
      for (const arch of resourceArchetypes) {
        archetypeIndex.get(arch)?.add(specId);
      }
      return {
        resourceName: resource.name,
        resourceKey: resource.key,
        fieldCount: metrics.fieldCount,
        operationCount: metrics.operationCount,
        operationPattern: metrics.operationPattern,
        maxDepth: metrics.maxDepth,
        enums: metrics.enumCount,
        arrayOfObjects: metrics.arrayOfObjectsCount,
        maps: metrics.mapCount,
        nullable: metrics.nullableCount,
        primitiveOnly: metrics.primitiveOnly,
        responseShape: metrics.listResponseShape,
        archetypes: resourceArchetypes,
      };
    });

    outputSpecs.push({
      specId,
      corpus,
      resourceCount: specMetrics.resourceCount,
      operationCount: specMetrics.operationCount,
      maxFieldsPerResource: specMetrics.maxFieldsPerResource,
      maxDepth: specMetrics.maxDepth,
      maxArrayOfObjects: specMetrics.maxArrayOfObjects,
      specComplexityScore: computeSpecComplexityScore(specMetrics),
      resources,
    });
  }

  const sortedSpecs = outputSpecs.sort((a, b) => a.specId.localeCompare(b.specId));
  const archetypesObj: Record<string, string[]> = {};
  for (const [arch, set] of archetypeIndex) {
    archetypesObj[arch] = [...set].sort();
  }
  const sortedArchetypes = Object.fromEntries(
    Object.entries(archetypesObj).sort(([a], [b]) => a.localeCompare(b))
  );

  if (showArchetype) {
    const specIds = sortedArchetypes[showArchetype] ?? [];
    if (specIds.length === 0) {
      console.log(`No specs match archetype '${showArchetype}'`);
    } else {
      console.log(`Archetype '${showArchetype}': ${specIds.length} specs`);
      for (const specId of specIds) {
        const spec = sortedSpecs.find((s) => s.specId === specId);
        if (!spec) continue;
        const matchingResources = spec.resources.filter((r) =>
          r.archetypes.includes(showArchetype)
        );
        for (const res of matchingResources) {
          console.log(
            `  ${specId} | ${res.resourceKey} | fields=${res.fieldCount} opPattern=${res.operationPattern} depth=${res.maxDepth}`
          );
        }
        if (matchingResources.length === 0 && SPEC_LEVEL_ARCHETYPES.has(showArchetype)) {
          console.log(`  ${specId} | (spec-level)`);
        }
      }
    }
    return 0;
  }

  const data = {
    meta: {
      toolVersion: '1.0',
      timestamp: new Date().toISOString(),
      specCount: specs.length,
      resourceCount,
    },
    archetypes: sortedArchetypes,
    specs: sortedSpecs,
  };

  if (writeJson) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`Wrote ${outputJsonPath}`);
  }

  if (writeReport) {
    mkdirSync(dirname(goldenCandidatesPath), { recursive: true });
    const { selected, zeroArchetypes } = selectGoldenCandidates(sortedSpecs, sortedArchetypes);
    writeGoldenCandidatesReport(selected, goldenCandidatesPath);
    for (const arch of zeroArchetypes) {
      console.error(`⚠ Archetype '${arch}' has no matching specs.`);
    }
    if (zeroArchetypes.length === 0) {
      const uniqueSpecs = new Set(
        Array.from(selected.values()).flatMap((arr) => arr.map((c) => c.specId))
      );
      console.log(
        `Golden candidates: ${uniqueSpecs.size} unique specs across ${ARCHETYPE_ORDER.length} archetypes`
      );
    }
  }

  return 0;
}

const SPEC_LEVEL_ARCHETYPES = new Set(['multi_resource', 'mixed_operations', 'large_api']);

/** Select 1–3 candidates per archetype with cross-archetype deduplication. */
function selectGoldenCandidates(
  specs: Array<{
    specId: string;
    specComplexityScore: number;
    resourceCount: number;
    resources: Array<{
      resourceKey: string;
      fieldCount: number;
      arrayOfObjects: number;
      archetypes: string[];
    }>;
  }>,
  archetypeIndex: Record<string, string[]>
): {
  selected: Map<string, Candidate[]>;
  zeroArchetypes: string[];
} {
  const specMap = new Map(specs.map((s) => [s.specId, s]));
  const selectedSpecs = new Set<string>();
  const selected = new Map<string, Candidate[]>();
  const zeroArchetypes: string[] = [];

  for (const archetype of ARCHETYPE_ORDER) {
    const candidates: Candidate[] = [];
    const bySpec = new Map<string, Candidate>();

    if (SPEC_LEVEL_ARCHETYPES.has(archetype)) {
      const specIds = archetypeIndex[archetype] ?? [];
      for (const specId of specIds) {
        const spec = specMap.get(specId);
        if (!spec) continue;
        const resourceKey = spec.resources[0]?.resourceKey ?? 'spec';
        const fieldCount = spec.resources[0]?.fieldCount ?? 0;
        const arrayOfObjects = spec.resources[0]?.arrayOfObjects ?? 0;
        bySpec.set(specId, {
          specId,
          resourceKey,
          archetype,
          score: spec.specComplexityScore,
          fieldCount,
          arrayOfObjectsCount: arrayOfObjects,
          resourceCount: spec.resourceCount,
        });
      }
    } else {
      for (const spec of specs) {
        for (const res of spec.resources) {
          if (!res.archetypes.includes(archetype)) continue;
          const c: Candidate = {
            specId: spec.specId,
            resourceKey: res.resourceKey,
            archetype,
            score: spec.specComplexityScore,
            fieldCount: res.fieldCount,
            arrayOfObjectsCount: res.arrayOfObjects,
            resourceCount: spec.resourceCount,
          };
          const existing = bySpec.get(spec.specId);
          if (!existing || res.resourceKey.localeCompare(existing.resourceKey) < 0) {
            bySpec.set(spec.specId, c);
          }
        }
      }
    }

    candidates.push(...bySpec.values());

    if (candidates.length === 0) {
      zeroArchetypes.push(archetype);
      selected.set(archetype, []);
      continue;
    }

    candidates.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.specId !== b.specId) return a.specId.localeCompare(b.specId);
      return a.resourceKey.localeCompare(b.resourceKey);
    });

    const chosen: Candidate[] = [];
    for (const c of candidates) {
      if (chosen.length >= 3) break;
      if (selectedSpecs.has(c.specId) && chosen.length > 0) continue;
      chosen.push(c);
      selectedSpecs.add(c.specId);
    }

    selected.set(archetype, chosen);
  }

  return { selected, zeroArchetypes };
}

function writeGoldenCandidatesReport(selected: Map<string, Candidate[]>, path: string): void {
  const lines: string[] = ['# Golden Spec Candidates by Archetype', ''];

  ARCHETYPE_ORDER.forEach((archetype, i) => {
    const idx = i + 1;
    const candidates = selected.get(archetype) ?? [];
    lines.push(`## ${idx}. ${archetype}`);
    if (candidates.length === 0) {
      lines.push('- *(no matching specs)*');
    } else {
      for (const c of candidates) {
        const metrics = `score=${c.score}, fields=${c.fieldCount}, arrayOfObjects=${c.arrayOfObjectsCount}, resources=${c.resourceCount}`;
        lines.push(`- ${c.specId} (${c.resourceKey}) (${metrics})`);
      }
    }
    lines.push('');
  });

  writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log(`Wrote ${path}`);
}

function isRunAsCliScript(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isRunAsCliScript()) {
  process.exit(main());
}
