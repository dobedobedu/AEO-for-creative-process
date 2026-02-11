-- ⚠️ DEPRECATED: This file is no longer the source of truth.
-- Use `supabase/migrations/` and the Supabase CLI workflow instead.
-- See docs/SSES-DEPLOYMENT-GUIDE.md for canonical process.
-- Canonical migration: supabase/migrations/20240101000012_multi_tenant_columns.sql

-- Migration 003: Backfill existing data to default tenant
-- Purpose: Associate existing data with the default tenant
-- Run: psql $DATABASE_URL -f sql/migrations/003_backfill_tenant_id.sql

-- Default tenant ID (created in migration 002)
DO $$
DECLARE
  default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  rows_updated INTEGER;
BEGIN
  -- Backfill runs
  UPDATE runs
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in runs table', rows_updated;

  -- Backfill responses
  UPDATE responses
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in responses table', rows_updated;

  -- Backfill run_citations
  UPDATE run_citations
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in run_citations table', rows_updated;

  -- Backfill run_entity_mentions
  UPDATE run_entity_mentions
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in run_entity_mentions table', rows_updated;

  -- Backfill run_metrics
  UPDATE run_metrics
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in run_metrics table', rows_updated;

  -- Backfill matrix_personas
  UPDATE matrix_personas
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in matrix_personas table', rows_updated;

  -- Backfill matrix_stages
  UPDATE matrix_stages
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in matrix_stages table', rows_updated;

  -- Backfill intents
  UPDATE intents
  SET tenant_id = default_tenant_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in intents table', rows_updated;

  -- Backfill intent_library_meta if exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_library_meta') THEN
    UPDATE intent_library_meta
    SET tenant_id = default_tenant_id
    WHERE tenant_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in intent_library_meta table', rows_updated;
  END IF;

  RAISE NOTICE 'Migration 003 complete: Backfilled all existing data to default tenant';
END $$;
