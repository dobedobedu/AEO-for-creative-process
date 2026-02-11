-- ⚠️ DEPRECATED: This file is no longer the source of truth.
-- Use `supabase/migrations/` and the Supabase CLI workflow instead.
-- See docs/SSES-DEPLOYMENT-GUIDE.md for canonical process.
-- Canonical migration: supabase/migrations/20240101000012_multi_tenant_columns.sql
-- Note: Rollback is legacy-only; canonical workflow uses supabase db reset.

-- Rollback for Migration 001: Remove tenant_id columns
-- WARNING: This will lose all tenant_id data
-- Run only if you need to fully revert multi-tenancy changes

ALTER TABLE runs DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE responses DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE run_citations DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE run_entity_mentions DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE run_metrics DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE matrix_personas DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE matrix_stages DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE intents DROP COLUMN IF EXISTS tenant_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_library_meta') THEN
    ALTER TABLE intent_library_meta DROP COLUMN IF EXISTS tenant_id;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Rollback 001 complete: Removed tenant_id columns';
END $$;
