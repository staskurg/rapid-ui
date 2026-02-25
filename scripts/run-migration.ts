#!/usr/bin/env tsx
/**
 * Run compilations table migration.
 * Usage: npx tsx --env-file=.env.local scripts/run-migration.ts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("POSTGRES_URL or DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(url);

async function run() {
  await sql`
    CREATE TABLE IF NOT EXISTS compilations (
      id VARCHAR(12) PRIMARY KEY,
      account_id VARCHAR(36) NOT NULL,
      name VARCHAR(255),
      status VARCHAR(20) DEFAULT 'success',
      specs JSONB NOT NULL,
      api_ir JSONB NOT NULL,
      openapi_canonical_hash VARCHAR(64) NOT NULL,
      resource_names JSONB NOT NULL,
      resource_slugs JSONB NOT NULL,
      diff_from_previous JSONB,
      errors JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_compilations_account_id ON compilations(account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_compilations_updated_at ON compilations(updated_at DESC)`;
  console.log("Migration complete: compilations table ready");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
