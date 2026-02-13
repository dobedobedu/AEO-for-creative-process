-- Migration 000012: Multi-tenant columns, tenant_configs table, backfill, and indexes
-- Consolidates: sql/migrations/001_add_tenant_id.sql
--               sql/migrations/002_create_tenant_configs.sql
--               sql/migrations/003_backfill_tenant_id.sql
--               sql/migrations/004_add_tenant_indexes.sql
-- Style: Incremental (assumes prior migrations 000000–000011 have run)

-- ============================================
-- Part 1: Add tenant_id columns (from 001)
-- ============================================

-- Add nullable tenant_id columns to all relevant tables
-- In Phase 1, these remain nullable for backward compatibility

ALTER TABLE runs
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE responses
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE run_citations
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE run_entity_mentions
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE run_metrics
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE matrix_personas
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE matrix_stages
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE intents
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- intent_library_meta (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_library_meta') THEN
    ALTER TABLE intent_library_meta ADD COLUMN IF NOT EXISTS tenant_id UUID;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN runs.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';
COMMENT ON COLUMN responses.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';
COMMENT ON COLUMN run_citations.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';
COMMENT ON COLUMN run_entity_mentions.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';
COMMENT ON COLUMN run_metrics.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';
COMMENT ON COLUMN matrix_personas.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';
COMMENT ON COLUMN matrix_stages.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';
COMMENT ON COLUMN intents.tenant_id IS 'Tenant identifier for multi-tenancy (nullable in Phase 1)';

-- ============================================
-- Part 2: Create tenant_configs table (from 002)
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(50) NOT NULL UNIQUE,
  tenant_name VARCHAR(255) NOT NULL,
  industry VARCHAR(50) NOT NULL DEFAULT 'other',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_configs_slug ON tenant_configs(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_configs_industry ON tenant_configs(industry);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_configs_updated_at ON tenant_configs;
CREATE TRIGGER tenant_configs_updated_at
  BEFORE UPDATE ON tenant_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_configs_updated_at();

-- Insert default tenant (used for backward compatibility)
INSERT INTO tenant_configs (id, tenant_slug, tenant_name, industry, config_json)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Default Tenant',
  'real_estate',
  '{}'::jsonb
)
ON CONFLICT (tenant_slug) DO NOTHING;

COMMENT ON TABLE tenant_configs IS 'Stores tenant configuration for multi-tenant deployments';
COMMENT ON COLUMN tenant_configs.tenant_slug IS 'URL-friendly unique identifier for tenant';
COMMENT ON COLUMN tenant_configs.config_json IS 'Full tenant configuration (mirrors config/tenant.json structure)';

-- ============================================
-- Part 3: Backfill existing data to default tenant (from 003)
-- ============================================

DO $$
DECLARE
  default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  rows_updated INTEGER;
BEGIN
  UPDATE runs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in runs table', rows_updated;

  UPDATE responses SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in responses table', rows_updated;

  UPDATE run_citations SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in run_citations table', rows_updated;

  UPDATE run_entity_mentions SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in run_entity_mentions table', rows_updated;

  UPDATE run_metrics SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in run_metrics table', rows_updated;

  UPDATE matrix_personas SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in matrix_personas table', rows_updated;

  UPDATE matrix_stages SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in matrix_stages table', rows_updated;

  UPDATE intents SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in intents table', rows_updated;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_library_meta') THEN
    UPDATE intent_library_meta SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in intent_library_meta table', rows_updated;
  END IF;

  RAISE NOTICE 'Backfill complete: All existing data associated with default tenant';
END $$;

-- ============================================
-- Part 4: Add tenant_id indexes (from 004)
-- NOTE: CONCURRENTLY removed — cannot run inside Supabase migration transaction
-- ============================================

CREATE INDEX IF NOT EXISTS idx_runs_tenant
ON runs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_responses_tenant
ON responses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_run_citations_tenant
ON run_citations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_run_entity_mentions_tenant
ON run_entity_mentions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_run_metrics_tenant
ON run_metrics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_matrix_personas_tenant
ON matrix_personas(tenant_id);

CREATE INDEX IF NOT EXISTS idx_matrix_stages_tenant
ON matrix_stages(tenant_id);

CREATE INDEX IF NOT EXISTS idx_intents_tenant
ON intents(tenant_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_runs_tenant_timestamp
ON runs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_tenant_run
ON responses(tenant_id, run_id);

CREATE INDEX IF NOT EXISTS idx_run_metrics_tenant_run
ON run_metrics(tenant_id, run_id);
