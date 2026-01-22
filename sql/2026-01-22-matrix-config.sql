-- Migration: Matrix Configuration Management
-- Date: January 22, 2026
-- Purpose: Add tables for managing personas and stages in Admin Matrix Studio

-- ============================================
-- 1. Create matrix_personas table
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL UNIQUE,  -- e.g., "move_up", "retiree"
  label TEXT NOT NULL,               -- e.g., "Move-Up", "Retiree"
  description TEXT,                  -- Short description for UI
  full_text TEXT,                    -- Detailed persona description
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_matrix_personas_order ON matrix_personas(order_index);

-- Index for active personas
CREATE INDEX IF NOT EXISTS idx_matrix_personas_active ON matrix_personas(active) WHERE active = true;

-- ============================================
-- 2. Create matrix_stages table
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id TEXT NOT NULL UNIQUE,     -- e.g., "explore", "consider"
  label TEXT NOT NULL,               -- e.g., "Explore", "Consider"
  description TEXT,                  -- Short description for UI
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  core_stage BOOLEAN NOT NULL DEFAULT false,  -- Whether this is a core stage
  primary_metric TEXT,               -- Primary metric for this stage: "discovery_rate", "sentiment_score", "win_rate", "recommendation_rate"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_matrix_stages_order ON matrix_stages(order_index);

-- Index for active stages
CREATE INDEX IF NOT EXISTS idx_matrix_stages_active ON matrix_stages(active) WHERE active = true;

-- ============================================
-- 3. Create matrix_config_versions table
-- ============================================

CREATE TABLE IF NOT EXISTS matrix_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  personas_json JSONB NOT NULL,      -- Snapshot of personas configuration
  stages_json JSONB NOT NULL,        -- Snapshot of stages configuration
  created_by UUID NULL,              -- User who created this version
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Index for finding published versions
CREATE INDEX IF NOT EXISTS idx_matrix_config_status ON matrix_config_versions(status, created_at DESC);

-- ============================================
-- 4. Insert default personas
-- ============================================

INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
VALUES
  ('move_up', 'Move-Up', 'Upgrading from starter home', 'Millennial or Gen X, college education, HHI $100-200K, married with children. Seeking a larger home with more amenities for their growing family. Image focused, buying designer clothes. Wants to eat healthy but often grabs takeout for ease. Thrives in social settings.', 0, true),
  ('retiree', 'Retiree', '55+ active lifestyle', 'Gen X or Boomer, college education, HHI $100-$200K, married without children at home. Seeking to downsize as they become empty nesters or retire. Purchases high quality brands, particularly if they support a cause. Frequently diets to stay in shape. Likely to use smart home devices.', 1, true),
  ('luxury', 'Luxury', 'High-end amenities focus', 'Millennial or Gen X, college or grad school education, HHI $200K+, married, potentially with children. Seeking a custom home in an esteemed community. Career-focused and a natural leader. An early adopter of products and services. Intelligent and well-informed.', 2, true),
  ('first_time', 'First-Time', 'Entry-level, value-conscious', 'Gen Z or Millennial, college or high school education, HHI $100-200K, some married with kids, some single. Seeking their first home in a community where they can grow. Follows trends and celebrities. Eager to get ahead and become successful. A risk taker and thrill seeker.', 3, true)
ON CONFLICT (persona_id) DO NOTHING;

-- ============================================
-- 5. Insert default stages
-- ============================================

INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, primary_metric)
VALUES
  ('explore', 'Explore', 'Starting research', 0, true, true, 'discovery_rate'),
  ('consider', 'Consider', 'Evaluating options', 1, true, true, 'sentiment_score'),
  ('compare', 'Compare', 'Narrowing choices', 2, true, true, 'win_rate'),
  ('decide', 'Decide', 'Ready to buy', 3, true, true, 'recommendation_rate')
ON CONFLICT (stage_id) DO NOTHING;

-- ============================================
-- 6. Create initial published version
-- ============================================

INSERT INTO matrix_config_versions (version, status, personas_json, stages_json)
SELECT 1, 'published',
  (SELECT jsonb_agg(jsonb_build_object(
    'id', p.persona_id,
    'label', p.label,
    'description', p.description,
    'fullText', p.full_text,
    'orderIndex', p.order_index,
    'active', p.active
  ) ORDER BY p.order_index)
  FROM matrix_personas p
  WHERE p.active = true),
  (SELECT jsonb_agg(jsonb_build_object(
    'id', s.stage_id,
    'label', s.label,
    'description', s.description,
    'orderIndex', s.order_index,
    'active', s.active,
    'coreStage', s.core_stage,
    'primaryMetric', s.primary_metric
  ) ORDER BY s.order_index)
  FROM matrix_stages s
  WHERE s.active = true);

-- ============================================
-- 7. Create trigger for updated_at
-- ============================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS update_matrix_personas_updated_at ON matrix_personas;
DROP TRIGGER IF EXISTS update_matrix_stages_updated_at ON matrix_stages;

-- Create triggers
CREATE TRIGGER update_matrix_personas_updated_at
  BEFORE UPDATE ON matrix_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matrix_stages_updated_at
  BEFORE UPDATE ON matrix_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Helper function to get active matrix config
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
      'primaryMetric', s.primary_metric
    ) ORDER BY s.order_index)
    FROM matrix_stages s
    WHERE s.active = true) AS stages;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verification queries (commented out)
-- ============================================

-- Check personas
-- SELECT * FROM matrix_personas ORDER BY order_index;

-- Check stages
-- SELECT * FROM matrix_stages ORDER BY order_index;

-- Check config versions
-- SELECT * FROM matrix_config_versions ORDER BY created_at DESC;

-- Get active config
-- SELECT * FROM get_active_matrix_config();
