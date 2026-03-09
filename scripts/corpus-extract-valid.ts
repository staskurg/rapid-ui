#!/usr/bin/env tsx
/**
 * Extract valid RUS-v1 specs from raw corpus batch reports into rapidui-corpus-valid-v1.
 *
 * Reads raw-{repo}-*.json files, collects valid results, deduplicates, and writes:
 *   - rapidui-corpus-valid-v1-{repo}.json  (full manifest with metadata)
 *   - rapidui-corpus-valid-v1-{repo}.txt   (paths only, one per line)
 *
 * Usage: npm run corpus:extract-valid -- --repo REPO [--copy-to-fixtures]
 *   REPO: api-guru | github
 *   --copy-to-fixtures: copy valid specs to tests/compiler/fixtures/valid-specs-{repo}
 *
 *   or:  tsx scripts/corpus-extract-valid.ts [--repo REPO] [--reports-dir PATH] [--copy-to-fixtures]
 */

import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from "fs";
import { join } from "path";

interface CorpusResult {
  path: string;
  valid: boolean;
  errors: Array<{ code: string; message: string; jsonPointer?: string }>;
  violationCount: number;
  compileTimeMs: number;
  crashed: boolean;
  parseFailed: boolean;
  parseError?: string;
  openapiVersion?: string;
  resourceCount?: number;
  fieldCount?: number;
}

interface RawOutput {
  meta: { batch: number | string; sampleSize: number; timestamp: string };
  results: CorpusResult[];
}

interface ValidSpecEntry {
  path: string;
  batch: number | string;
  openapiVersion?: string;
  resourceCount?: number;
  fieldCount?: number;
  compileTimeMs: number;
}

const VALID_REPOS = ["api-guru", "github"] as const;
type RepoName = (typeof VALID_REPOS)[number];

function main(): number {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  let reportsDir = join(cwd, "scripts", "corpus-data", "reports");

  let copyToFixtures = false;
  let repo: RepoName | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--repo" && args[i + 1]) {
      const r = args[++i];
      if (VALID_REPOS.includes(r as RepoName)) {
        repo = r as RepoName;
      } else {
        console.error(`Unknown repo: ${r}. Use api-guru or github.`);
        return 1;
      }
    } else if (args[i] === "--reports-dir" && args[i + 1]) {
      reportsDir = args[++i];
    } else if (args[i] === "--copy-to-fixtures") {
      copyToFixtures = true;
    }
  }

  if (!repo) {
    console.error("Usage: npm run corpus:extract-valid -- --repo REPO [--copy-to-fixtures]");
    console.error("  REPO: api-guru | github");
    return 1;
  }

  if (!existsSync(reportsDir)) {
    console.error(`Reports directory not found: ${reportsDir}`);
    return 1;
  }

  const rawPrefix = `raw-${repo}-`;
  const files = readdirSync(reportsDir)
    .filter((f) => f.endsWith(".json") && f.startsWith(rawPrefix))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.error(`No ${rawPrefix}*.json files found in ${reportsDir}`);
    return 1;
  }

  const validByPath = new Map<string, ValidSpecEntry>();

  for (const file of files) {
    const filePath = join(reportsDir, file);
    let data: RawOutput;
    try {
      data = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`Failed to read ${file}:`, err);
      continue;
    }

    const batch = data.meta?.batch ?? 0;
    const validResults = (data.results ?? []).filter(
      (r) => r.valid && !r.parseFailed && !r.crashed
    );

    for (const r of validResults) {
      if (!validByPath.has(r.path)) {
        validByPath.set(r.path, {
          path: r.path,
          batch,
          openapiVersion: r.openapiVersion,
          resourceCount: r.resourceCount,
          fieldCount: r.fieldCount,
          compileTimeMs: r.compileTimeMs,
        });
      }
    }
  }

  const validList = Array.from(validByPath.values()).sort((a, b) => {
    if (a.batch !== b.batch) {
      const na = typeof a.batch === "number" ? a.batch : 0;
      const nb = typeof b.batch === "number" ? b.batch : 0;
      if (typeof a.batch === "number" && typeof b.batch === "number") return na - nb;
      if (typeof a.batch === "number") return -1;
      if (typeof b.batch === "number") return 1;
      return String(a.batch).localeCompare(String(b.batch));
    }
    return a.path.localeCompare(b.path);
  });

  const outputDir = join(cwd, "scripts", "corpus-data");
  mkdirSync(outputDir, { recursive: true });

  const manifestName = `rapidui-corpus-valid-v1-${repo}`;
  const manifestPath = join(outputDir, `${manifestName}.json`);
  const listPath = join(outputDir, `${manifestName}.txt`);

  const source =
    repo === "api-guru" ? "APIs.guru (via openapi-directory)" : "GitHub";

  const manifest = {
    meta: {
      name: manifestName,
      description: "OpenAPI specs that pass RUS-v1 validation",
      source,
      repo,
      extractedAt: new Date().toISOString(),
      totalSpecs: validList.length,
    },
    specs: validList,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  writeFileSync(listPath, validList.map((s) => s.path).join("\n") + "\n", "utf-8");

  console.log(`Extracted ${validList.length} valid specs to ${manifestName}`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  Path list: ${listPath}`);

  if (copyToFixtures) {
    const fixturesDir = join(cwd, "tests", "compiler", "fixtures", `valid-specs-${repo}`);
    mkdirSync(fixturesDir, { recursive: true });
    let copied = 0;
    for (const spec of validList) {
      const srcPath = join(cwd, spec.path);
      const filename = spec.path.split("/").pop() ?? spec.path;
      const destPath = join(fixturesDir, filename);
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, destPath);
        copied++;
      } else {
        console.warn(`  Skipped (not found): ${spec.path}`);
      }
    }
    console.log(`  Copied ${copied} specs to tests/compiler/fixtures/valid-specs-${repo}`);
  }

  return 0;
}

process.exit(main());
