/**
 * Postgres-backed compilation store.
 * Requires POSTGRES_URL or DATABASE_URL.
 */
import { neon } from "@neondatabase/serverless";
import type { UISpec } from "@/lib/spec/types";
import type { ApiIR, Capabilities } from "@/lib/compiler/apiir";
import { deriveCapabilities } from "@/lib/compiler/apiir";

export interface CompilationEntry {
  specs: Record<string, UISpec>;
  resourceNames: string[];
  resourceSlugs: string[];
  apiIr: ApiIR;
  capabilitiesBySlug: Record<string, Capabilities>;
  identityFieldsBySlug: Record<string, string[]>;
  openapiCanonicalHash: string;
  accountId?: string;
  name?: string;
  status?: "success" | "failed";
  errors?: unknown[];
  diffFromPrevious?: {
    byPage: Array<{
      name: string;
      type: "added" | "removed" | "unchanged";
      addedFields: string[];
      removedFields: string[];
    }>;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CompilationListItem {
  id: string;
  name: string;
  status: "success" | "failed";
  createdAt?: string;
  updatedAt?: string;
}

function getSql() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("POSTGRES_URL or DATABASE_URL is required");
  }
  return neon(url);
}

/** Wrap DB operations: log errors and re-throw. Callers (API routes, pages) will surface 500. */
async function withDbErrorHandling<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[compilations] ${op} failed:`, err);
    throw err;
  }
}

function rowToEntry(row: Record<string, unknown>): CompilationEntry {
  const apiIr = row.api_ir as ApiIR;
  // TODO(mvp-v3-cleanup): Remove lazy backfill once all phases are done and no pre-Phase-1.1
  // compilations exist in production. Options: (1) run migration to add capabilities to api_ir,
  // (2) persist capabilitiesBySlug at write time and drop this derivation. Then remove this block
  // and the deriveCapabilities import.
  if (!apiIr.resources?.[0]?.capabilities) {
    deriveCapabilities(apiIr);
  }
  const capabilitiesBySlug: Record<string, Capabilities> = Object.fromEntries(
    (apiIr.resources ?? []).map((r) => [r.key, r.capabilities!])
  );
  const identityFieldsBySlug: Record<string, string[]> = Object.fromEntries(
    (apiIr.resources ?? []).map((r) => [r.key, r.identityFields ?? []])
  );
  return {
    specs: (row.specs as Record<string, UISpec>) ?? {},
    resourceNames: (row.resource_names as string[]) ?? [],
    resourceSlugs: (row.resource_slugs as string[]) ?? [],
    apiIr,
    capabilitiesBySlug,
    identityFieldsBySlug,
    openapiCanonicalHash: (row.openapi_canonical_hash as string) ?? "",
    accountId: row.account_id as string | undefined,
    name: row.name as string | undefined,
    status: (row.status as "success" | "failed") ?? "success",
    errors: row.errors as unknown[] | undefined,
    diffFromPrevious: row.diff_from_previous as CompilationEntry["diffFromPrevious"],
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

export async function putCompilation(
  id: string,
  entry: Omit<
    CompilationEntry,
    "createdAt" | "updatedAt" | "capabilitiesBySlug" | "identityFieldsBySlug"
  > &
    Partial<Pick<CompilationEntry, "createdAt" | "updatedAt">>
): Promise<void> {
  return withDbErrorHandling("putCompilation", async () => {
    const sql = getSql();
    const now = new Date().toISOString();

    await sql`
    INSERT INTO compilations (
      id, account_id, name, status, specs, api_ir, openapi_canonical_hash,
      resource_names, resource_slugs, diff_from_previous, errors, created_at, updated_at
    ) VALUES (
      ${id},
      ${entry.accountId ?? null},
      ${entry.name ?? null},
      ${entry.status ?? "success"},
      ${JSON.stringify(entry.specs)},
      ${JSON.stringify(entry.apiIr)},
      ${entry.openapiCanonicalHash},
      ${JSON.stringify(entry.resourceNames)},
      ${JSON.stringify(entry.resourceSlugs)},
      ${entry.diffFromPrevious ? JSON.stringify(entry.diffFromPrevious) : null},
      ${entry.errors ? JSON.stringify(entry.errors) : null},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      specs = EXCLUDED.specs,
      api_ir = EXCLUDED.api_ir,
      openapi_canonical_hash = EXCLUDED.openapi_canonical_hash,
      resource_names = EXCLUDED.resource_names,
      resource_slugs = EXCLUDED.resource_slugs,
      diff_from_previous = EXCLUDED.diff_from_previous,
      errors = EXCLUDED.errors,
      updated_at = EXCLUDED.updated_at,
      created_at = compilations.created_at
  `;
  });
}

export async function getCompilation(
  id: string
): Promise<CompilationEntry | undefined> {
  return withDbErrorHandling("getCompilation", async () => {
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM compilations WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) return undefined;
    return rowToEntry(row as Record<string, unknown>);
  });
}

export async function hasCompilation(id: string): Promise<boolean> {
  return withDbErrorHandling("hasCompilation", async () => {
    const sql = getSql();
    const rows = await sql`
      SELECT 1 FROM compilations WHERE id = ${id} LIMIT 1
    `;
    return rows.length > 0;
  });
}

export async function listCompilationsByAccount(
  accountId: string
): Promise<CompilationListItem[]> {
  return withDbErrorHandling("listCompilationsByAccount", async () => {
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, status, created_at, updated_at
      FROM compilations
      WHERE account_id = ${accountId}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `;

    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: (row.name as string) ?? (row.id as string),
      status: (row.status as "success" | "failed") ?? "success",
      createdAt: row.created_at as string | undefined,
      updatedAt: row.updated_at as string | undefined,
    }));
  });
}

export async function deleteCompilation(id: string): Promise<void> {
  return withDbErrorHandling("deleteCompilation", async () => {
    const sql = getSql();
    await sql`DELETE FROM compilations WHERE id = ${id}`;
  });
}
