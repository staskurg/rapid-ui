#!/usr/bin/env tsx
/**
 * Extract valid RUS-v1 specs from raw corpus batch reports into rapidui-corpus-valid-v1.
 *
 * Reads all raw-batch*.json files, collects valid results, deduplicates, and writes:
 *   - rapidui-corpus-valid-v1.json  (full manifest with metadata)
 *   - rapidui-corpus-valid-v1.txt   (paths only, one per line)
 *
 * Usage: npm run corpus:extract-valid
 *   or:  npm run corpus:extract-valid -- --copy-to-fixtures
 *   or:  npm run corpus:extract-valid -- --github-only   # only raw-github-*.json (exclude APIs.guru batches)
 *   or:  tsx scripts/corpus-extract-valid.ts [--reports-dir PATH] [--copy-to-fixtures] [--github-only]
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

function main(): number {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  let reportsDir = join(cwd, "scripts", "corpus-data", "reports");

  let copyToFixtures = false;
  let githubOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--reports-dir" && args[i + 1]) {
      reportsDir = args[++i];
    } else if (args[i] === "--copy-to-fixtures") {
      copyToFixtures = true;
    } else if (args[i] === "--github-only") {
      githubOnly = true;
    }
  }

  if (!existsSync(reportsDir)) {
    console.error(`Reports directory not found: ${reportsDir}`);
    return 1;
  }

  const files = readdirSync(reportsDir)
    .filter((f) => {
      if (!f.endsWith(".json")) return false;
      if (githubOnly) return f.startsWith("raw-github-");
      return f.startsWith("raw-batch") || f.startsWith("raw-github-");
    })
    .sort((a, b) => {
      const isBatchA = a.startsWith("raw-batch");
      const isBatchB = b.startsWith("raw-batch");
      if (isBatchA && isBatchB) {
        const na = parseInt(a.replace("raw-batch", "").split("-")[0], 10);
        const nb = parseInt(b.replace("raw-batch", "").split("-")[0], 10);
        return na - nb;
      }
      if (isBatchA) return -1;
      if (isBatchB) return 1;
      return a.localeCompare(b);
    });

  if (files.length === 0) {
    console.error(
      githubOnly
        ? `No raw-github-*.json files found in ${reportsDir}`
        : `No raw-batch*.json or raw-github-*.json files found in ${reportsDir}`
    );
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

  const manifestPath = join(outputDir, "rapidui-corpus-valid-v1.json");
  const listPath = join(outputDir, "rapidui-corpus-valid-v1.txt");

  const hasCorpusGithub = validList.some((s) => s.path.includes("corpus-github"));
  const hasApisGuru = validList.some((s) => s.path.includes("specs/"));
  let source: string;
  if (hasCorpusGithub && hasApisGuru) {
    source = "APIs.guru (via openapi-directory) + GitHub";
  } else if (hasCorpusGithub) {
    source = "GitHub";
  } else {
    source = "APIs.guru (via openapi-directory)";
  }

  const manifest = {
    meta: {
      name: "rapidui-corpus-valid-v1",
      description: "OpenAPI specs that pass RUS-v1 validation",
      source,
      extractedAt: new Date().toISOString(),
      totalSpecs: validList.length,
    },
    specs: validList,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  writeFileSync(listPath, validList.map((s) => s.path).join("\n") + "\n", "utf-8");

  console.log(`Extracted ${validList.length} valid specs to rapidui-corpus-valid-v1`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  Path list: ${listPath}`);

  if (copyToFixtures) {
    const fixturesDir = join(cwd, "tests", "compiler", "fixtures", "corpus-valid-v1");
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
    console.log(`  Copied ${copied} specs to ${fixturesDir}`);
  }

  return 0;
}

process.exit(main());
