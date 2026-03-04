#!/usr/bin/env tsx
/**
 * RUS-v1 compliance check: parse → validateSubset → resolveRefs → buildApiIR.
 * Output: VALID or INVALID with code, message, jsonPointer for each violation.
 *
 * Usage: npm run check:openapi -- path/to/spec.yaml
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { resolveRefs } from "@/lib/compiler/openapi/ref-resolver";
import { buildApiIR } from "@/lib/compiler/apiir";
import type { CompilerError } from "@/lib/compiler/errors";

function main(): number {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error("Usage: npm run check:openapi -- <path-to-spec.yaml|.json>");
    process.exit(1);
  }

  const absPath = resolve(process.cwd(), specPath);
  if (!existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  let content: string;
  try {
    content = readFileSync(absPath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to read file: ${msg}`);
    process.exit(1);
  }

  const parseResult = parseOpenAPI(content);
  if (!parseResult.success) {
    printInvalid([parseResult.error]);
    return 1;
  }

  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) {
    printInvalid(validateResult.errors);
    return 1;
  }

  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) {
    printInvalid([resolveResult.error]);
    return 1;
  }

  const buildResult = buildApiIR(resolveResult.doc);
  if (!buildResult.success) {
    printInvalid([buildResult.error]);
    return 1;
  }

  console.log("VALID");
  return 0;
}

function printInvalid(errors: CompilerError[]): void {
  console.log("INVALID");
  for (const e of errors) {
    const pointer = e.jsonPointer ? ` (${e.jsonPointer})` : "";
    console.log(`  ${e.code}: ${e.message}${pointer}`);
  }
}

process.exit(main());
