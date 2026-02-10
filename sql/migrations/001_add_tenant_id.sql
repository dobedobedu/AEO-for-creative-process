-- Migration 001: Add tenant_id columns
-- Purpose: Prepare tables for multi-tenancy (Phase 1: nullable columns)
-- Run: psql $DATABASE_URL -f sql/migrations/001_add_tenant_id.sql
-- Rollback: See 001_add_tenant_id_rollback.sql

-- Add nullable tenant_id columns to all relevant tables
-- In Phase 1, these remain nullable for backward compatibility

-- runs table
ALTER TABLE runs
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- responses table
ALTER TABLE responses
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- run_citations table
ALTER TABLE run_citations
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- run_entity_mentions table
ALTER TABLE run_entity_mentions
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- run_metrics table
ALTER TABLE run_metrics
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- matrix_personas table
ALTER TABLE matrix_personas
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- matrix_stages table
ALTER TABLE matrix_stages
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- intents table
ALTER TABLE intents
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- intent_library_meta table (if exists)
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 001 complete: Added tenant_id columns to all tables';
END $$;
