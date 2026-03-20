#!/usr/bin/env tsx
/**
 * Copy OpenAPI 3.0.x and 3.1.x specs from openapi-directory to corpus-data/specs/api_guru.
 * All specs in a single flat folder.
 *
 * Usage: npm run copy:openapi-specs
 *   or:  tsx scripts/copy-openapi-specs.ts [--openapi-dir PATH]
 */

import {
  readFileSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  rmSync,
  existsSync,
} from 'fs';
import { join, relative, extname } from 'path';
import { parseOpenAPI } from '@/lib/compiler/openapi/parser';
const SPEC_EXTENSIONS = ['.yaml', '.yml', '.json'];

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
  if (typeof openapi !== 'string') return false;
  return openapi.startsWith('3.0') || openapi.startsWith('3.1');
}

function sanitizeFilename(relPath: string): string {
  return relPath.replace(/\//g, '__').replace(/\\/g, '__');
}

function main(): number {
  const args = process.argv.slice(2);
  let openapiDir = join(process.cwd(), '..', 'openapi-directory', 'APIs');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--openapi-dir' && args[i + 1]) {
      openapiDir = args[++i];
    }
  }

  const outputBase = join(process.cwd(), 'scripts', 'corpus-data', 'specs', 'api_guru');

  console.log('Scanning OpenAPI specs...');
  console.log(`  Source: ${openapiDir}`);
  console.log(`  Output: ${outputBase}`);

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

  console.log('\nValidating specs (OpenAPI 3.0.x/3.1.x)...');
  for (let idx = 0; idx < specFiles.length; idx++) {
    const filePath = specFiles[idx];
    if ((idx + 1) % progressInterval === 0 || idx === specFiles.length - 1) {
      process.stdout.write(`  ${idx + 1}/${specFiles.length} checked\r`);
    }
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
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
  console.log(''); // newline after \r

  console.log(`Valid OpenAPI 3.0.x/3.1.x: ${validSpecs.length}`);
  console.log(`Skipped (Swagger 2.0 or other): ${skipped}`);
  console.log(`Invalid/unparseable: ${invalid}`);

  // Clear existing output folder
  if (existsSync(outputBase)) {
    const existing = readdirSync(outputBase);
    for (const name of existing) {
      const p = join(outputBase, name);
      if (statSync(p).isDirectory()) {
        rmSync(p, { recursive: true });
      } else {
        rmSync(p);
      }
    }
  }

  mkdirSync(outputBase, { recursive: true });

  let copied = 0;
  const copyProgressInterval = Math.max(100, Math.floor(validSpecs.length / 20));

  console.log(`\nCopying ${validSpecs.length} specs...`);
  for (let i = 0; i < validSpecs.length; i++) {
    const { path: srcPath, relPath } = validSpecs[i];
    const safeName = sanitizeFilename(relPath);
    const destPath = join(outputBase, safeName);
    try {
      copyFileSync(srcPath, destPath);
      copied++;
    } catch (err) {
      console.error(`Failed to copy ${relPath}: ${err}`);
    }
    if ((i + 1) % copyProgressInterval === 0 || i === validSpecs.length - 1) {
      process.stdout.write(`  ${i + 1}/${validSpecs.length} copied\r`);
    }
  }
  console.log('');

  console.log(`\nDone. Copied ${copied} specs to ${outputBase}`);
  return 0;
}

process.exit(main());
