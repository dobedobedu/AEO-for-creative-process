-- Migration 004: Add tenant_id indexes for query performance
-- Purpose: Optimize queries filtering by tenant
-- Run: psql $DATABASE_URL -f sql/migrations/004_add_tenant_indexes.sql

-- Add indexes for tenant_id on all tables
-- Using CONCURRENTLY for production safety (won't lock tables)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_runs_tenant
ON runs(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_tenant
ON responses(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_run_citations_tenant
ON run_citations(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_run_entity_mentions_tenant
ON run_entity_mentions(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_run_metrics_tenant
ON run_metrics(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matrix_personas_tenant
ON matrix_personas(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matrix_stages_tenant
ON matrix_stages(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_intents_tenant
ON intents(tenant_id);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_runs_tenant_timestamp
ON runs(tenant_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_tenant_run
ON responses(tenant_id, run_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_run_metrics_tenant_run
ON run_metrics(tenant_id, run_id);

DO $$
BEGIN
  RAISE NOTICE 'Migration 004 complete: Added tenant_id indexes';
END $$;
