#!/usr/bin/env tsx
/**
 * Copy OpenAPI 3.0.x and 3.1.x specs from openapi-directory to corpus-data/specs.
 * Splits into batches of 100, each batch in a separate folder (1, 2, 3, ...).
 *
 * Usage: npm run copy:openapi-specs
 *   or:  tsx scripts/copy-openapi-specs.ts [--openapi-dir PATH] [--batch-size N]
 */

import {
  readFileSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  rmSync,
} from "fs";
import { join, relative, extname } from "path";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";

const BATCH_SIZE = 100;
const SPEC_EXTENSIONS = [".yaml", ".yml", ".json"];

function findSpecFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...findSpecFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (SPEC_EXTENSIONS.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function isOpenApi30Or31(doc: Record<string, unknown>): boolean {
  const openapi = doc.openapi;
  if (typeof openapi !== "string") return false;
  return openapi.startsWith("3.0") || openapi.startsWith("3.1");
}

function sanitizeFilename(relPath: string): string {
  return relPath.replace(/\//g, "__").replace(/\\/g, "__");
}

function main(): number {
  const args = process.argv.slice(2);
  let openapiDir = join(process.cwd(), "..", "openapi-directory", "APIs");
  let batchSize = BATCH_SIZE;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--openapi-dir" && args[i + 1]) {
      openapiDir = args[++i];
    } else if (args[i] === "--batch-size" && args[i + 1]) {
      batchSize = parseInt(args[++i], 10) || BATCH_SIZE;
    }
  }

  const outputBase = join(process.cwd(), "scripts", "corpus-data", "specs");

  console.log("Scanning OpenAPI specs...");
  console.log(`  Source: ${openapiDir}`);
  console.log(`  Output: ${outputBase}`);
  console.log(`  Batch size: ${batchSize}`);

  let specFiles: string[];
  try {
    specFiles = findSpecFiles(openapiDir, openapiDir);
  } catch (err) {
    console.error(`Failed to scan directory: ${err}`);
    return 1;
  }

  console.log(`Found ${specFiles.length} spec files`);

  const validSpecs: { path: string; relPath: string }[] = [];
  let skipped = 0;
  let invalid = 0;
  const progressInterval = Math.max(100, Math.floor(specFiles.length / 20));

  console.log("\nValidating specs (OpenAPI 3.0.x/3.1.x)...");
  for (let idx = 0; idx < specFiles.length; idx++) {
    const filePath = specFiles[idx];
    if ((idx + 1) % progressInterval === 0 || idx === specFiles.length - 1) {
      process.stdout.write(`  ${idx + 1}/${specFiles.length} checked\r`);
    }
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      invalid++;
      continue;
    }

    const parseResult = parseOpenAPI(content);
    if (!parseResult.success) {
      invalid++;
      continue;
    }

    if (!isOpenApi30Or31(parseResult.doc)) {
      skipped++;
      continue;
    }

    const relPath = relative(openapiDir, filePath);
    validSpecs.push({ path: filePath, relPath });
  }
  console.log(""); // newline after \r

  console.log(`Valid OpenAPI 3.0.x/3.1.x: ${validSpecs.length}`);
  console.log(`Skipped (Swagger 2.0 or other): ${skipped}`);
  console.log(`Invalid/unparseable: ${invalid}`);

  // Clear existing batch folders
  try {
    const existing = readdirSync(outputBase);
    for (const name of existing) {
      const p = join(outputBase, name);
      if (statSync(p).isDirectory() && /^\d+$/.test(name)) {
        rmSync(p, { recursive: true });
      }
    }
  } catch {
    // outputBase might not exist yet
  }

  mkdirSync(outputBase, { recursive: true });

  let batchIndex = 1;
  let copied = 0;
  const totalBatches = Math.ceil(validSpecs.length / batchSize);

  console.log(`\nCopying to batches (${totalBatches} batch(es))...`);
  for (let i = 0; i < validSpecs.length; i += batchSize) {
    const batch = validSpecs.slice(i, i + batchSize);
    const batchDir = join(outputBase, String(batchIndex));
    mkdirSync(batchDir, { recursive: true });

    for (const { path: srcPath, relPath } of batch) {
      const safeName = sanitizeFilename(relPath);
      const destPath = join(batchDir, safeName);
      try {
        copyFileSync(srcPath, destPath);
        copied++;
      } catch (err) {
        console.error(`Failed to copy ${relPath}: ${err}`);
      }
    }

    process.stdout.write(
      `  Batch ${batchIndex}/${totalBatches}: ${copied}/${validSpecs.length} copied\r`
    );
    batchIndex++;
  }
  console.log(""); // newline after \r

  console.log(`\nDone. Copied ${copied} specs into ${batchIndex - 1} batch(es).`);
  return 0;
}

process.exit(main());
