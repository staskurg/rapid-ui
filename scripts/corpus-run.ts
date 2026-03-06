#!/usr/bin/env tsx
/**
 * Phase 4 corpus run: run RUS-v1 check on a batch of OpenAPI specs.
 * parse → validateSubset → resolveRefs → buildApiIR per spec.
 *
 * Usage: npm run corpus:run -- --batch N
 * Output: scripts/corpus-data/reports/raw-batch{N}-{timestamp}.json
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { buildApiIR } from "@/lib/compiler/apiir";
const SPEC_EXTENSIONS = [".yaml", ".yml", ".json"];

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

interface CleanListItem {
  id: string;
  path: string;
  openapiVersion?: string;
}

interface RawOutput {
  meta: {
    batch: number | string;
    sampleSize: number;
    timestamp: string;
    cleanList: CleanListItem[];
  };
  results: CorpusResult[];
}

function getSpecId(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const ext = base.lastIndexOf(".");
  return ext > 0 ? base.slice(0, ext) : base;
}

function collectSpecFiles(dir: string, recurse: boolean): Array<{ absPath: string; relPath: string }> {
  const cwd = process.cwd();
  const out: Array<{ absPath: string; relPath: string }> = [];

  function walk(d: string) {
    const entries = readdirSync(d);
    for (const e of entries) {
      const abs = join(d, e);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        if (recurse) {
          walk(abs);
        }
      } else {
        const ext = e.toLowerCase().slice(e.lastIndexOf("."));
        if (SPEC_EXTENSIONS.includes(ext)) {
          out.push({ absPath: abs, relPath: relative(cwd, abs) });
        }
      }
    }
  }

  walk(dir);
  return out;
}

function runSpec(
  absPath: string,
  relPath: string,
  cwd: string
): CorpusResult {
  const result: CorpusResult = {
    path: relPath,
    valid: false,
    errors: [],
    violationCount: 0,
    compileTimeMs: 0,
    crashed: false,
    parseFailed: false,
  };

  const start = performance.now();

  let content: string;
  try {
    content = readFileSync(absPath, "utf-8");
  } catch (err) {
    result.parseFailed = true;
    result.parseError = err instanceof Error ? err.message : String(err);
    result.compileTimeMs = Math.round(performance.now() - start);
    return result;
  }

  try {
    const parseResult = parseOpenAPI(content);
    if (!parseResult.success) {
      result.parseFailed = true;
      result.parseError = parseResult.error.message;
      result.compileTimeMs = Math.round(performance.now() - start);
      return result;
    }

    const openapi = parseResult.doc.openapi;
    result.openapiVersion =
      typeof openapi === "string" ? openapi : undefined;

    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) {
      result.errors = validateResult.errors.map((e) => ({
        code: e.code,
        message: e.message,
        jsonPointer: e.jsonPointer,
      }));
      result.violationCount = result.errors.length;
      result.compileTimeMs = Math.round(performance.now() - start);
      return result;
    }

    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) {
      result.errors = [
        {
          code: resolveResult.error.code,
          message: resolveResult.error.message,
          jsonPointer: resolveResult.error.jsonPointer,
        },
      ];
      result.violationCount = 1;
      result.compileTimeMs = Math.round(performance.now() - start);
      return result;
    }

    const buildResult = buildApiIR(resolveResult.doc);
    if (!buildResult.success) {
      result.errors = [
        {
          code: buildResult.error.code,
          message: buildResult.error.message,
          jsonPointer: buildResult.error.jsonPointer,
        },
      ];
      result.violationCount = 1;
      result.compileTimeMs = Math.round(performance.now() - start);
      return result;
    }

    result.valid = true;
    result.compileTimeMs = Math.round(performance.now() - start);
    result.resourceCount = buildResult.apiIr.resources.length;
    result.fieldCount = buildResult.apiIr.resources.reduce((sum, r) => {
      return (
        sum +
        r.operations.reduce((opSum, op) => {
          const schema = op.responseSchema as Record<string, unknown> | undefined;
          const props = schema?.properties as Record<string, unknown> | undefined;
          return opSum + (props ? Object.keys(props).length : 0);
        }, 0)
      );
    }, 0);
    return result;
  } catch (err) {
    result.crashed = true;
    result.errors = [
      {
        code: "COMPILER_CRASH",
        message: err instanceof Error ? err.message : String(err),
      },
    ];
    result.violationCount = 1;
    result.compileTimeMs = Math.round(performance.now() - start);
    return result;
  }
}

function main(): number {
  const args = process.argv.slice(2);
  let batchNum: number | null = null;
  let specsDirArg: string | null = null;
  let outputName: string | null = null;
  let recurse = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--batch" && args[i + 1]) {
      batchNum = parseInt(args[++i], 10);
    } else if (args[i] === "--specs-dir" && args[i + 1]) {
      specsDirArg = args[++i];
    } else if (args[i] === "--output-name" && args[i + 1]) {
      outputName = args[++i];
    } else if (args[i] === "--recurse") {
      recurse = true;
    }
  }

  const cwd = process.cwd();
  const reportsDir = join(cwd, "scripts", "corpus-data", "reports");
  let specsDir: string;
  let batch: number | string;
  let specFiles: Array<{ absPath: string; relPath: string }>;

  if (specsDirArg != null) {
    if (outputName == null || outputName === "") {
      console.error("When using --specs-dir, --output-name is required.");
      return 1;
    }
    specsDir = join(cwd, specsDirArg);
    batch = outputName;
    if (!existsSync(specsDir)) {
      console.error(`Specs directory not found: ${specsDir}`);
      return 1;
    }
    specFiles = collectSpecFiles(specsDir, recurse);
  } else {
    if (batchNum == null || isNaN(batchNum) || batchNum < 1) {
      console.error("Usage: npm run corpus:run -- --batch N");
      console.error("   or: npm run corpus:run -- --specs-dir PATH --output-name NAME [--recurse]");
      console.error("Example: npm run corpus:run -- --batch 20");
      console.error("Example: npm run corpus:run -- --specs-dir scripts/corpus-data/corpus-github/group-generic --output-name github-generic");
      return 1;
    }
    specsDir = join(cwd, "scripts", "corpus-data", "specs", String(batchNum));
    batch = batchNum;
    if (!existsSync(specsDir)) {
      console.error(`Batch directory not found: ${specsDir}`);
      return 1;
    }
    specFiles = collectSpecFiles(specsDir, false);
  }

  if (specFiles.length === 0) {
    console.error(`No spec files in ${specsDir}`);
    return 1;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputBase = typeof batch === "number" ? `raw-batch${batch}` : `raw-${batch}`;
  const outputPath = join(reportsDir, `${outputBase}-${timestamp}.json`);

  mkdirSync(reportsDir, { recursive: true });

  console.log(`Running corpus on ${batch} (${specFiles.length} specs)...`);

  const results: CorpusResult[] = [];
  const cleanList: CleanListItem[] = [];

  for (let i = 0; i < specFiles.length; i++) {
    const { absPath, relPath } = specFiles[i];
    const r = runSpec(absPath, relPath, cwd);
    results.push(r);

    if (!r.parseFailed) {
      const file = relPath.split("/").pop() ?? relPath;
      cleanList.push({
        id: getSpecId(file),
        path: relPath,
        openapiVersion: r.openapiVersion,
      });
    }

    if ((i + 1) % 20 === 0 || i === specFiles.length - 1) {
      process.stdout.write(`  ${i + 1}/${specFiles.length} processed\r`);
    }
  }
  console.log("");

  const validCount = results.filter((r) => r.valid).length;
  const crashCount = results.filter((r) => r.crashed).length;
  const parseFailCount = results.filter((r) => r.parseFailed).length;

  const output: RawOutput = {
    meta: {
      batch,
      sampleSize: results.length,
      timestamp: new Date().toISOString(),
      cleanList,
    },
    results,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\nDone. Output: ${outputPath}`);
  console.log(`  Valid: ${validCount}/${results.length} (${((validCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Parse failures: ${parseFailCount}`);
  console.log(`  Compiler crashes: ${crashCount}`);

  return 0;
}

process.exit(main());
