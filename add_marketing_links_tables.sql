-- Create tables for Marketing Links: marketing_shares (immutable snapshots) and marketing_aliases (no-redirect alias)
-- Includes foreign keys and useful indexes

-- Ensure UUID generator is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) marketing_shares: one row per published snapshot (immutable)
CREATE TABLE IF NOT EXISTS marketing_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  patient_id UUID NOT NULL,
  snapshot_json JSONB NOT NULL,
  schema_version INT NOT NULL DEFAULT 1,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  view_count INT NOT NULL DEFAULT 0,
  cta_click_count INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_marketing_shares_patient
    FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_marketing_shares_patient_id ON marketing_shares (patient_id);
-- JSONB GIN index (optional, enable if you plan to query inside snapshot_json)
-- CREATE INDEX IF NOT EXISTS idx_marketing_shares_snapshot_json ON marketing_shares USING GIN (snapshot_json);

-- 2) marketing_aliases: maps alias -> current slug (latest active snapshot)
CREATE TABLE IF NOT EXISTS marketing_aliases (
  alias TEXT PRIMARY KEY,
  current_slug TEXT NOT NULL,
  patient_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_marketing_aliases_current_slug
    FOREIGN KEY (current_slug) REFERENCES marketing_shares(slug) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_aliases_patient
    FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Case-insensitive uniqueness for alias (enforce via unique index on lower(alias))
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_aliases_alias_lower ON marketing_aliases (lower(alias));

-- Trigger to update updated_at on marketing_aliases changes
CREATE OR REPLACE FUNCTION set_updated_at_marketing_aliases()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_aliases_updated_at ON marketing_aliases;
CREATE TRIGGER trg_marketing_aliases_updated_at
BEFORE UPDATE ON marketing_aliases
FOR EACH ROW EXECUTE FUNCTION set_updated_at_marketing_aliases();


