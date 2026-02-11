-- Canonical Migration: Matrix Configuration Management
-- Source: sql/2026-01-22-matrix-config.sql
-- Purpose: Add tables for managing personas and stages in Admin Matrix Studio
-- Note: Tenant-specific seed data (personas, stages, initial config version) removed.
--        Seed data should be applied separately per deployment.

-- ============================================
-- 1. Create matrix_personas table
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  full_text TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matrix_personas_order ON matrix_personas(order_index);
CREATE INDEX IF NOT EXISTS idx_matrix_personas_active ON matrix_personas(active) WHERE active = true;

-- ============================================
-- 2. Create matrix_stages table
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  core_stage BOOLEAN NOT NULL DEFAULT false,
  core_stage_mapping TEXT,
  primary_metric TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matrix_stages_order ON matrix_stages(order_index);
CREATE INDEX IF NOT EXISTS idx_matrix_stages_active ON matrix_stages(active) WHERE active = true;

-- ============================================
-- 3. Create matrix_config_versions table
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  personas_json JSONB NOT NULL,
  stages_json JSONB NOT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_matrix_config_status ON matrix_config_versions(status, created_at DESC);

-- ============================================
-- 4. Create trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_matrix_personas_updated_at ON matrix_personas;
DROP TRIGGER IF EXISTS update_matrix_stages_updated_at ON matrix_stages;

CREATE TRIGGER update_matrix_personas_updated_at
  BEFORE UPDATE ON matrix_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matrix_stages_updated_at
  BEFORE UPDATE ON matrix_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Helper function to get active matrix config
-- ============================================

CREATE OR REPLACE FUNCTION get_active_matrix_config()
RETURNS TABLE (
  personas JSONB,
  stages JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT jsonb_agg(jsonb_build_object(
      'id', p.persona_id,
      'label', p.label,
      'description', p.description,
      'fullText', p.full_text,
      'orderIndex', p.order_index,
      'active', p.active
    ) ORDER BY p.order_index)
    FROM matrix_personas p
    WHERE p.active = true) AS personas,
    (SELECT jsonb_agg(jsonb_build_object(
      'id', s.stage_id,
      'label', s.label,
      'description', s.description,
      'orderIndex', s.order_index,
      'active', s.active,
      'coreStage', s.core_stage,
      'coreStageMapping', s.core_stage_mapping,
      'primaryMetric', s.primary_metric
    ) ORDER BY s.order_index)
    FROM matrix_stages s
    WHERE s.active = true) AS stages;
END;
$$ LANGUAGE plpgsql;
