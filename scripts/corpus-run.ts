#!/usr/bin/env tsx
/**
 * Phase 4 corpus run: run RUS-v1 check on a batch of OpenAPI specs.
 * parse → validateSubset → resolveRefs → buildApiIR per spec.
 *
 * Usage: npm run corpus:run -- --batch N
 * Output: scripts/corpus-data/reports/raw-batch{N}-{timestamp}.json
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
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
    batch: number;
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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--batch" && args[i + 1]) {
      batchNum = parseInt(args[++i], 10);
      break;
    }
  }

  if (batchNum == null || isNaN(batchNum) || batchNum < 1) {
    console.error("Usage: npm run corpus:run -- --batch N");
    console.error("Example: npm run corpus:run -- --batch 20");
    return 1;
  }

  const cwd = process.cwd();
  const specsDir = join(cwd, "scripts", "corpus-data", "specs", String(batchNum));
  const reportsDir = join(cwd, "scripts", "corpus-data", "reports");

  if (!existsSync(specsDir)) {
    console.error(`Batch directory not found: ${specsDir}`);
    return 1;
  }

  const files = readdirSync(specsDir).filter((f) => {
    const ext = f.toLowerCase().slice(f.lastIndexOf("."));
    return SPEC_EXTENSIONS.includes(ext);
  });

  if (files.length === 0) {
    console.error(`No spec files in ${specsDir}`);
    return 1;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = join(
    reportsDir,
    `raw-batch${batchNum}-${timestamp}.json`
  );

  mkdirSync(reportsDir, { recursive: true });

  console.log(`Running corpus on batch ${batchNum} (${files.length} specs)...`);

  const results: CorpusResult[] = [];
  const cleanList: CleanListItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const absPath = join(specsDir, file);
    const relPath = `scripts/corpus-data/specs/${batchNum}/${file}`;

    const r = runSpec(absPath, relPath, cwd);
    results.push(r);

    if (!r.parseFailed) {
      cleanList.push({
        id: getSpecId(file),
        path: relPath,
        openapiVersion: r.openapiVersion,
      });
    }

    if ((i + 1) % 20 === 0 || i === files.length - 1) {
      process.stdout.write(`  ${i + 1}/${files.length} processed\r`);
    }
  }
  console.log("");

  const validCount = results.filter((r) => r.valid).length;
  const crashCount = results.filter((r) => r.crashed).length;
  const parseFailCount = results.filter((r) => r.parseFailed).length;

  const output: RawOutput = {
    meta: {
      batch: batchNum,
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
