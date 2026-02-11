-- Canonical Migration: Entity Extraction Tables
-- Source: sql/2026-01-24-entity-tables.sql
-- Purpose: Track which entities/features are mentioned by LLMs (Kanban view)
-- Note: Tenant-specific seed data (entity categories, entity terms) removed.
--        Seed data should be applied separately per deployment.
--        BEGIN/COMMIT wrappers removed (Supabase handles transactions automatically).

-- ============================================
-- 1. Entity Categories (Kanban lanes)
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_entity_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Entity Terms (trackable entities within categories)
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_entity_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT NOT NULL REFERENCES matrix_entity_categories(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  aliases JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entity_terms_unique UNIQUE(category_id, canonical_name)
);

CREATE INDEX IF NOT EXISTS idx_entity_terms_category ON matrix_entity_terms(category_id);
CREATE INDEX IF NOT EXISTS idx_entity_terms_active ON matrix_entity_terms(active) WHERE active = true;

-- ============================================
-- 3. Run Entity Mentions (per-response extractions)
-- ============================================

CREATE TABLE IF NOT EXISTS run_entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  persona TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'xai')),
  query_index INT NOT NULL DEFAULT 0,

  entity_term_id UUID REFERENCES matrix_entity_terms(id) ON DELETE SET NULL,
  raw_mention TEXT NOT NULL,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  context_snippet TEXT,
  match_confidence NUMERIC(3,2) DEFAULT 1.0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_run ON run_entity_mentions(run_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON run_entity_mentions(entity_term_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_run_entity ON run_entity_mentions(run_id, entity_term_id);

-- ============================================
-- 4. Run Entity Summary (aggregated for Kanban display)
-- ============================================

CREATE TABLE IF NOT EXISTS run_entity_summary (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  entity_term_id UUID NOT NULL REFERENCES matrix_entity_terms(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES matrix_entity_categories(id),

  total_responses INT NOT NULL DEFAULT 0,
  mention_count INT NOT NULL DEFAULT 0,
  mention_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_sentiment NUMERIC(4,3),

  by_provider JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (run_id, entity_term_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_summary_run ON run_entity_summary(run_id);
CREATE INDEX IF NOT EXISTS idx_entity_summary_category ON run_entity_summary(category_id);
CREATE INDEX IF NOT EXISTS idx_entity_summary_rate ON run_entity_summary(mention_rate DESC);

-- ============================================
-- 5. Helper function for mention rate status
-- ============================================

CREATE OR REPLACE FUNCTION get_entity_status(rate NUMERIC)
RETURNS TEXT AS $$
BEGIN
  IF rate >= 0.80 THEN
    RETURN 'preferred';
  ELSIF rate >= 0.60 THEN
    RETURN 'recommended';
  ELSIF rate >= 0.40 THEN
    RETURN 'mentioned';
  ELSE
    RETURN 'blind_spot';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
