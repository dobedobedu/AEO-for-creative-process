-- Rollback Migration 007: Remove Row Level Security (RLS) Policies
-- Purpose: Disable RLS if needed for debugging or migration issues
-- Run: psql $DATABASE_URL -f sql/migrations/007_add_rls_policies_rollback.sql

-- Drop policies first
DROP POLICY IF EXISTS tenant_isolation_runs ON runs;
DROP POLICY IF EXISTS tenant_isolation_responses ON responses;
DROP POLICY IF EXISTS tenant_isolation_run_citations ON run_citations;
DROP POLICY IF EXISTS tenant_isolation_run_entity_mentions ON run_entity_mentions;
DROP POLICY IF EXISTS tenant_isolation_run_metrics ON run_metrics;
DROP POLICY IF EXISTS tenant_isolation_intents ON intents;
DROP POLICY IF EXISTS tenant_isolation_matrix_personas ON matrix_personas;
DROP POLICY IF EXISTS tenant_isolation_matrix_stages ON matrix_stages;
DROP POLICY IF EXISTS tenant_isolation_intent_library_meta ON intent_library_meta;
DROP POLICY IF EXISTS tenant_isolation_intent_history ON intent_history;

-- Disable RLS on tables
ALTER TABLE runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE run_citations DISABLE ROW LEVEL SECURITY;
ALTER TABLE run_entity_mentions DISABLE ROW LEVEL SECURITY;
ALTER TABLE run_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE intents DISABLE ROW LEVEL SECURITY;

-- Disable on optional tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matrix_personas') THEN
    ALTER TABLE matrix_personas DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matrix_stages') THEN
    ALTER TABLE matrix_stages DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_library_meta') THEN
    ALTER TABLE intent_library_meta DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_history') THEN
    ALTER TABLE intent_history DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Rollback 007 complete: RLS policies removed from all tables';
END $$;
