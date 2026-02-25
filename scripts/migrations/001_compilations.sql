-- Compilation store: compiled OpenAPI specs and UI metadata.
-- Run: psql $POSTGRES_URL -f scripts/migrations/001_compilations.sql
-- Or paste into Neon SQL Editor.

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
);

CREATE INDEX IF NOT EXISTS idx_compilations_account_id ON compilations(account_id);
CREATE INDEX IF NOT EXISTS idx_compilations_updated_at ON compilations(updated_at DESC);
