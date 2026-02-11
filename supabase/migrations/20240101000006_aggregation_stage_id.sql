-- Canonical Migration: Add stage_id to aggregation tables
-- Source: sql/2026-01-23-aggregation-stage-id.sql
-- Purpose: Support custom stage IDs while maintaining core stage compatibility
-- Note: Broken run_summary_mv materialized view removed (referenced non-existent
--        columns like r.run_date, rm.avg_discovery_rate). Only valid ALTER TABLE
--        operations and indexes are retained.

-- ============================================
-- 1. Update run_metrics table
-- ============================================

-- Rename stage column to core_stage
ALTER TABLE run_metrics
  RENAME COLUMN stage TO core_stage;

-- Add stage_id column for actual stage ID
ALTER TABLE run_metrics
  ADD COLUMN stage_id TEXT NOT NULL DEFAULT 'unknown';

-- Add constraint for core_stage
ALTER TABLE run_metrics
  DROP CONSTRAINT IF EXISTS run_metrics_stage_check;

ALTER TABLE run_metrics
  ADD CONSTRAINT run_metrics_core_stage_check
  CHECK (core_stage IN ('explore', 'consider', 'compare', 'decide'));

-- Update unique constraint to include stage_id
ALTER TABLE run_metrics
  DROP CONSTRAINT IF EXISTS run_metrics_run_id_persona_stage_provider_key;

ALTER TABLE run_metrics
  ADD CONSTRAINT run_metrics_run_id_persona_stage_id_provider_key
  UNIQUE (run_id, persona, stage_id, provider);

-- Backfill: set stage_id = core_stage for existing data
UPDATE run_metrics
SET stage_id = core_stage
WHERE stage_id = 'unknown';

-- Remove default
ALTER TABLE run_metrics
  ALTER COLUMN stage_id DROP DEFAULT;

-- Create indexes for stage_id and core_stage lookups
CREATE INDEX IF NOT EXISTS idx_run_metrics_stage_id ON run_metrics(stage_id);
CREATE INDEX IF NOT EXISTS idx_run_metrics_core_stage ON run_metrics(core_stage);

-- ============================================
-- 2. Update run_citations table
-- ============================================

-- Rename stage column to core_stage
ALTER TABLE run_citations
  RENAME COLUMN stage TO core_stage;

-- Add stage_id column
ALTER TABLE run_citations
  ADD COLUMN stage_id TEXT NOT NULL DEFAULT 'unknown';

-- Add constraint for core_stage
ALTER TABLE run_citations
  DROP CONSTRAINT IF EXISTS run_citations_stage_check;

ALTER TABLE run_citations
  ADD CONSTRAINT run_citations_core_stage_check
  CHECK (core_stage IN ('explore', 'consider', 'compare', 'decide'));

-- Update unique constraint to include stage_id
ALTER TABLE run_citations
  DROP CONSTRAINT IF EXISTS run_citations_run_id_persona_stage_provider_key;

ALTER TABLE run_citations
  ADD CONSTRAINT run_citations_run_id_persona_stage_id_provider_key
  UNIQUE (run_id, persona, stage_id, provider);

-- Backfill: set stage_id = core_stage for existing data
UPDATE run_citations
SET stage_id = core_stage
WHERE stage_id = 'unknown';

-- Remove default
ALTER TABLE run_citations
  ALTER COLUMN stage_id DROP DEFAULT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_run_citations_stage_id ON run_citations(stage_id);
CREATE INDEX IF NOT EXISTS idx_run_citations_core_stage ON run_citations(core_stage);
