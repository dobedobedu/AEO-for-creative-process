-- Migration: Add stage_id to aggregation tables
-- Date: January 23, 2026
-- Purpose: Support custom stage IDs while maintaining core stage compatibility

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

-- Create index for stage_id lookups
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

-- ============================================
-- 3. Update run_summary view (if exists)
-- ============================================

-- Drop and recreate materialized view to include stage_id
DROP MATERIALIZED VIEW IF EXISTS run_summary_mv;

CREATE MATERIALIZED VIEW run_summary_mv AS
SELECT
  r.run_id,
  r.run_date,
  r.persona,
  r.stage_id,        -- NEW: actual stage ID
  r.core_stage,     -- NEW: core stage for scoring
  r.provider,
  r.total_cells,
  r.completed_cells,
  r.completion_rate,
  r.avg_discovery_rate,
  r.avg_top3_rate,
  r.avg_sentiment_score,
  r.avg_win_rate,
  r.avg_recommendation_rate,
  r.created_at
FROM (
  SELECT
    rm.run_id,
    r.run_date,
    rm.persona,
    rm.stage_id,
    rm.core_stage,
    rm.provider,
    COUNT(DISTINCT rm.run_id || '-' || rm.persona || '-' || rm.stage_id) as total_cells,
    COUNT(DISTINCT CASE WHEN rm.avg_discovery_rate >= 0 THEN rm.run_id || '-' || rm.persona || '-' || rm.stage_id END) as completed_cells,
    ROUND(CAST(COUNT(DISTINCT CASE WHEN rm.avg_discovery_rate >= 0 THEN rm.run_id || '-' || rm.persona || '-' || rm.stage_id END) AS NUMERIC) / NULLIF(COUNT(DISTINCT rm.run_id || '-' || rm.persona || '-' || rm.stage_id), 0) * 100, 2) as completion_rate,
    ROUND(AVG(rm.avg_discovery_rate) FILTER (WHERE rm.avg_discovery_rate IS NOT NULL), 4) as avg_discovery_rate,
    ROUND(AVG(rm.avg_top3_rate) FILTER (WHERE rm.avg_top3_rate IS NOT NULL), 4) as avg_top3_rate,
    ROUND(AVG(rm.avg_sentiment_score) FILTER (WHERE rm.avg_sentiment_score IS NOT NULL), 4) as avg_sentiment_score,
    ROUND(AVG(rm.win_rate) FILTER (WHERE rm.win_rate IS NOT NULL), 4) as avg_win_rate,
    ROUND(AVG(rm.recommendation_rate) FILTER (WHERE r.recommendation_rate IS NOT NULL), 4) as avg_recommendation_rate
  FROM run_metrics rm
  GROUP BY
    rm.run_id,
    r.run_date,
    rm.persona,
    rm.stage_id,
    rm.core_stage,
    rm.provider
) r;

-- Create unique index on the view
CREATE UNIQUE INDEX IF NOT EXISTS run_summary_mv_unique_idx ON run_summary_mv(run_id, persona, stage_id, provider);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_run_metadata()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY run_summary_mv;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verification queries (commented out)
-- ============================================

-- Check the schema
-- \d run_metrics
-- \d run_citations

-- Verify backfill
-- SELECT core_stage, stage_id, COUNT(*) FROM run_metrics GROUP BY core_stage, stage_id;

-- Check materialized view
-- SELECT * FROM run_summary_mv ORDER BY run_date DESC LIMIT 5;
