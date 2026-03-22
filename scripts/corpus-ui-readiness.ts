#!/usr/bin/env tsx
/**
 * UI readiness JSONL from committed ApiIR fixtures (Pipeline B: fixtures → verify → mining → this).
 *
 * **Grain:** one JSON object per line; **one row per `(specId, resourceKey)`**.
 *
 * - **specId:** path relative to `tests/compiler/fixtures/apiir/`, no `.json` suffix, forward slashes
 *   (e.g. `demo/golden_openapi_users_tagged_3_0`, `valid-specs-api-guru/petstore`). Collision-free across dirs.
 * - **resourceKey:** `ResourceIR.key` (same as ApiIR).
 * - **compositeKey:** `specId::resourceKey` — unique over the fixture set.
 *
 * **required_query_on_list:** **aggregate** boolean — `true` if any **list-like** operation (`list` or
 * `listScoped`) on the resource has at least one **required** query parameter (`ParameterIR.required === true`
 * on `in: "query"`). `false` when there are no list-like ops.
 *
 * **listLikeOps:** every list ∪ listScoped op on the resource (`id`, `kind`, `method`, `path`, optional
 * `queryParamCount`, `hasRequiredQuery`). **primaryListLikeOp** matches `primaryListLikeOperation` (list
 * before listScoped when both exist).
 *
 * Output: `scripts/corpus-data/reports/ui-readiness-{timestamp}.jsonl` unless `--output` is set.
 *
 * Usage: npm run corpus:ui-readiness [-- --output PATH]
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import type { ApiIR, OperationIR } from '@/lib/compiler/apiir';
import {
  filterListLikeOperations,
  PARAMETER_IN,
  primaryListLikeOperation,
} from '@/lib/compiler/apiir';

const FIXTURES_APIIR = join(process.cwd(), 'tests/compiler/fixtures/apiir');

interface ListLikeOpRow {
  id: string;
  kind: OperationIR['kind'];
  method: string;
  path: string;
  queryParamCount?: number;
  hasRequiredQuery: boolean;
}

interface UIReadinessRow {
  specId: string;
  specBasename: string;
  compositeKey: string;
  resourceKey: string;
  resourceName: string;
  apiIrVersion?: number;
  apiTitle: string;
  apiVersion: string;
  listLikeOps: ListLikeOpRow[];
  primaryListLikeOp: ListLikeOpRow | null;
  /** True iff some list-like op has a required query parameter. */
  required_query_on_list: boolean;
}

function walkJsonFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkJsonFiles(full, acc);
    } else if (name.endsWith('.json')) {
      acc.push(full);
    }
  }
  return acc;
}

function hasRequiredQueryOnOperation(op: OperationIR): boolean {
  for (const p of op.parameters ?? []) {
    if (p.in === PARAMETER_IN.query && p.required === true) return true;
  }
  return false;
}

function toListLikeRow(op: OperationIR): ListLikeOpRow {
  const q = op.queryParamCount;
  return {
    id: op.id,
    kind: op.kind,
    method: op.method,
    path: op.path,
    ...(q !== undefined && q > 0 ? { queryParamCount: q } : {}),
    hasRequiredQuery: hasRequiredQueryOnOperation(op),
  };
}

function rowsForSpec(apiIr: ApiIR, specId: string, specBasename: string): UIReadinessRow[] {
  const rows: UIReadinessRow[] = [];
  for (const res of apiIr.resources) {
    const listLikes = filterListLikeOperations(res.operations);
    const primary = primaryListLikeOperation(res.operations);
    const listLikeOps = listLikes.map(toListLikeRow);
    const required_query_on_list = listLikes.some((op) => hasRequiredQueryOnOperation(op));

    rows.push({
      specId,
      specBasename,
      compositeKey: `${specId}::${res.key}`,
      resourceKey: res.key,
      resourceName: res.name,
      ...(apiIr.apiIrVersion !== undefined ? { apiIrVersion: apiIr.apiIrVersion } : {}),
      apiTitle: apiIr.api.title,
      apiVersion: apiIr.api.version,
      listLikeOps,
      primaryListLikeOp: primary ? toListLikeRow(primary) : null,
      required_query_on_list,
    });
  }
  return rows;
}

function main(): number {
  const args = process.argv.slice(2);
  let outputPath: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      outputPath = args[++i];
    }
  }

  if (!existsSync(FIXTURES_APIIR)) {
    console.error(`ApiIR fixtures directory not found: ${FIXTURES_APIIR}`);
    return 1;
  }

  const files = walkJsonFiles(FIXTURES_APIIR).sort();
  if (files.length === 0) {
    console.error(`No ApiIR JSON files under ${FIXTURES_APIIR}`);
    return 1;
  }

  const lines: string[] = [];
  for (const filePath of files) {
    const rel = relative(FIXTURES_APIIR, filePath).replace(/\\/g, '/');
    const specId = rel.replace(/\.json$/i, '');
    const specBasename = specId.includes('/') ? specId.slice(specId.lastIndexOf('/') + 1) : specId;

    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`Failed to read ${filePath}: ${err}`);
      continue;
    }

    let apiIr: ApiIR;
    try {
      apiIr = JSON.parse(content) as ApiIR;
    } catch (err) {
      console.error(`Failed to parse ${filePath}: ${err}`);
      continue;
    }

    let rowCount = 0;
    for (const row of rowsForSpec(apiIr, specId, specBasename)) {
      lines.push(JSON.stringify(row));
      rowCount++;
    }
    console.log(`${specId}: ${rowCount} resource(s)`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const savePath =
    outputPath ?? join('scripts/corpus-data/reports', `ui-readiness-${timestamp}.jsonl`);
  const absPath = savePath.startsWith('/') ? savePath : join(process.cwd(), savePath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf-8');
  console.log(`Wrote ${lines.length} line(s) to ${absPath}`);
  return 0;
}

process.exit(main());
