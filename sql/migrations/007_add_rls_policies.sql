-- Migration 007: Add Row Level Security (RLS) Policies
-- Purpose: Enforce tenant isolation at the database level
-- Run: psql $DATABASE_URL -f sql/migrations/007_add_rls_policies.sql
--
-- IMPORTANT: Before enabling this:
-- 1. Ensure all data has been backfilled with tenant_id (run migration 003)
-- 2. Application must set app.tenant_id session variable before queries
-- 3. Test thoroughly in staging before production

-- ============================================
-- Step 1: Enable RLS on all data tables
-- ============================================

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE intents ENABLE ROW LEVEL SECURITY;

-- Optional: Enable on matrix config tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matrix_personas') THEN
    ALTER TABLE matrix_personas ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matrix_stages') THEN
    ALTER TABLE matrix_stages ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_library_meta') THEN
    ALTER TABLE intent_library_meta ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_history') THEN
    ALTER TABLE intent_history ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- Step 2: Create RLS Policies
-- Using current_setting('app.tenant_id', true) which returns NULL if not set
-- The true parameter means it won't error if the setting doesn't exist
-- ============================================

-- Runs table policies
CREATE POLICY tenant_isolation_runs ON runs
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR tenant_id IS NULL  -- Allow access to legacy data without tenant_id
    OR current_setting('app.tenant_id', true) IS NULL  -- Bypass when not set (for migrations)
  );

-- Responses table policies
CREATE POLICY tenant_isolation_responses ON responses
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR tenant_id IS NULL
    OR current_setting('app.tenant_id', true) IS NULL
  );

-- Run citations table policies
CREATE POLICY tenant_isolation_run_citations ON run_citations
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR tenant_id IS NULL
    OR current_setting('app.tenant_id', true) IS NULL
  );

-- Run entity mentions table policies
CREATE POLICY tenant_isolation_run_entity_mentions ON run_entity_mentions
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR tenant_id IS NULL
    OR current_setting('app.tenant_id', true) IS NULL
  );

-- Run metrics table policies
CREATE POLICY tenant_isolation_run_metrics ON run_metrics
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR tenant_id IS NULL
    OR current_setting('app.tenant_id', true) IS NULL
  );

-- Intents table policies
CREATE POLICY tenant_isolation_intents ON intents
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR tenant_id IS NULL
    OR current_setting('app.tenant_id', true) IS NULL
  );

-- Matrix personas table policies (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matrix_personas') THEN
    EXECUTE 'CREATE POLICY tenant_isolation_matrix_personas ON matrix_personas
      FOR ALL
      USING (
        tenant_id = current_setting(''app.tenant_id'', true)::uuid
        OR tenant_id IS NULL
        OR current_setting(''app.tenant_id'', true) IS NULL
      )';
  END IF;
END $$;

-- Matrix stages table policies (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matrix_stages') THEN
    EXECUTE 'CREATE POLICY tenant_isolation_matrix_stages ON matrix_stages
      FOR ALL
      USING (
        tenant_id = current_setting(''app.tenant_id'', true)::uuid
        OR tenant_id IS NULL
        OR current_setting(''app.tenant_id'', true) IS NULL
      )';
  END IF;
END $$;

-- Intent library meta table policies (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_library_meta') THEN
    EXECUTE 'CREATE POLICY tenant_isolation_intent_library_meta ON intent_library_meta
      FOR ALL
      USING (
        tenant_id = current_setting(''app.tenant_id'', true)::uuid
        OR tenant_id IS NULL
        OR current_setting(''app.tenant_id'', true) IS NULL
      )';
  END IF;
END $$;

-- Intent history table policies (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intent_history') THEN
    EXECUTE 'CREATE POLICY tenant_isolation_intent_history ON intent_history
      FOR ALL
      USING (
        tenant_id = current_setting(''app.tenant_id'', true)::uuid
        OR tenant_id IS NULL
        OR current_setting(''app.tenant_id'', true) IS NULL
      )';
  END IF;
END $$;

-- ============================================
-- Step 3: Grant permissions to application role
-- Note: Adjust role name if using a different database user
-- ============================================

-- Grant usage on the public schema
-- GRANT USAGE ON SCHEMA public TO your_app_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 007 complete: RLS policies enabled on all data tables';
  RAISE NOTICE 'IMPORTANT: Application must now set app.tenant_id before queries';
  RAISE NOTICE 'Example: SELECT set_config(''app.tenant_id'', ''your-tenant-uuid'', false)';
END $$;
