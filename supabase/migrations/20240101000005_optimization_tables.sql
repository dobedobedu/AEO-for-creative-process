-- Canonical Migration: Database Optimization Tables
-- Source: sql/2026-01-22-optimization-tables.sql
-- Purpose: Add aggregation tables and materialized view for fast queries
-- Note: BEGIN/COMMIT wrappers removed (Supabase handles transactions automatically)

-- ============================================
-- 1. Create run_metrics table (pre-computed aggregates)
-- ============================================

CREATE TABLE IF NOT EXISTS run_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('explore', 'consider', 'compare', 'decide')),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'xai')),

  responses_count INT NOT NULL DEFAULT 0,
  mentions_count INT NOT NULL DEFAULT 0,
  mention_rate NUMERIC(5,4) NOT NULL DEFAULT 0,

  sentiment_score NUMERIC(4,3),
  win_rate NUMERIC(5,4),
  recommendation_rate NUMERIC(5,4),
  top3_rate NUMERIC(5,4),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT run_metrics_unique UNIQUE(run_id, persona, stage, provider)
);

CREATE INDEX IF NOT EXISTS idx_run_metrics_run ON run_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_run_metrics_persona_stage ON run_metrics(persona, stage);
CREATE INDEX IF NOT EXISTS idx_run_metrics_provider ON run_metrics(provider);
CREATE INDEX IF NOT EXISTS idx_run_metrics_run_persona_stage ON run_metrics(run_id, persona, stage);

-- ============================================
-- 2. Create run_citations table (source attribution)
-- ============================================

CREATE TABLE IF NOT EXISTS run_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('explore', 'consider', 'compare', 'decide')),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'xai')),
  domain TEXT NOT NULL,

  citation_count INT NOT NULL DEFAULT 1,
  sample_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT run_citations_unique UNIQUE(run_id, persona, stage, provider, domain)
);

CREATE INDEX IF NOT EXISTS idx_run_citations_lookup ON run_citations(run_id, persona, stage, provider);
CREATE INDEX IF NOT EXISTS idx_run_citations_domain ON run_citations(domain);
CREATE INDEX IF NOT EXISTS idx_run_citations_run ON run_citations(run_id);

-- ============================================
-- 3. Create run_summary table (denormalized metrics)
-- ============================================

CREATE TABLE IF NOT EXISTS run_summary (
  run_id UUID PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,

  discovery_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_sentiment NUMERIC(4,3) NOT NULL DEFAULT 0,
  avg_win_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  recommendation_rate NUMERIC(5,4) NOT NULL DEFAULT 0,

  brand TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_summary_completed ON run_summary(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_summary_brand ON run_summary(brand);

-- ============================================
-- 4. Create materialized view for run metadata (fast history listing)
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS run_metadata_mv AS
SELECT
  r.id,
  (r.result_json->>'timestamp')::text AS timestamp,
  (r.result_json->>'brand')::text AS brand,
  (r.result_json->>'intentLibraryVersion')::int AS intent_library_version,
  (r.result_json->>'metricsConfigVersion')::int AS metrics_config_version,
  r.result_json->'summary' AS summary,
  r.completed_at,
  r.created_at
FROM runs r
WHERE r.result_json IS NOT NULL
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_run_metadata_mv_id ON run_metadata_mv(id);
CREATE INDEX IF NOT EXISTS idx_run_metadata_mv_timestamp ON run_metadata_mv(timestamp DESC NULLS LAST, created_at DESC);

-- ============================================
-- 5. Create trigger for updated_at on run_metrics
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_run_metrics_updated_at ON run_metrics;
CREATE TRIGGER update_run_metrics_updated_at
  BEFORE UPDATE ON run_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_run_summary_updated_at ON run_summary;
CREATE TRIGGER update_run_summary_updated_at
  BEFORE UPDATE ON run_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Create helper function to refresh materialized view
-- ============================================

CREATE OR REPLACE FUNCTION refresh_run_metadata_mv()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY run_metadata_mv;
END;
$$ LANGUAGE plpgsql;
