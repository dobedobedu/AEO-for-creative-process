-- ⚠️ DEPRECATED: This file is no longer the source of truth.
-- Use `supabase/migrations/` and the Supabase CLI workflow instead.
-- See docs/SSES-DEPLOYMENT-GUIDE.md for canonical process.
-- Tenant seed — not part of canonical migration chain.
-- Apply separately per deployment for SSES-specific personas, stages, and entity terms.

-- Migration: Update SSES Personas and Stages (Institutional Vanguard)
-- Date: January 26, 2026
-- Purpose: Update personas and stages to align with "The Institutional Vanguard" research

-- ============================================
-- 1. Update existing personas for SSES
-- ============================================

-- Update or insert "Wealthy Migrant" persona
INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
VALUES (
  'wealthy_migrant',
  'The Wealthy Migrant',
  'High-net-worth families relocating from NY/CA/NJ seeking prestige and community integration.',
  'High-net-worth families relocating from tax-heavy states (NY, NJ, CA) to the Florida Gulf Coast. These families prioritize academic prestige, community integration, and social networking. They view education as both an investment in their children''s future and a mechanism for establishing themselves in regional elite circles. Key decision factors include college placement outcomes, alumni network quality, and association with other prominent families.',
  0,
  true
)
ON CONFLICT (persona_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  full_text = EXCLUDED.full_text,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active;

-- Update or insert "Neurodivergent Advocate" persona
INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
VALUES (
  'neurodivergent_advocate',
  'The Neurodivergent Advocate',
  'Parents of gifted or "spiky" kids looking for the "Vibrant Anomaly" environment that celebrates neurodiversity.',
  'Parents of children who are gifted, twice-exceptional (2e), or neurodivergent (ADHD, ASD, dyslexia). These families have often had negative experiences with traditional schools that prioritize conformity over cognitive diversity. They seek environments that celebrate the "Vibrant Anomaly" - students with unusual intellectual profiles who think differently. Key decision factors include: strength-based approaches, flexible learning environments, expertise with twice-exceptional learners, and a culture that views neurodiversity as an advantage rather than a deficit.',
  1,
  true
)
ON CONFLICT (persona_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  full_text = EXCLUDED.full_text,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active;

-- Update or insert "Innovation Seeker" persona
INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
VALUES (
  'innovation_seeker',
  'The Innovation Seeker',
  'Tech-forward parents prioritizing STEAM, "Mini Xerox PARC" labs, and Artrepreneurship.',
  'Technology-forward parents who want their children to develop skills for the innovation economy. These families are often in tech, engineering, or entrepreneurial fields themselves. They seek schools with "Mini Xerox PARC" characteristics: slack for exploration, high-ceiling tools, first-principles thinking, and cross-pollination between disciplines. Key decision factors include: STEAM facilities (3D printing, AI labs), maker spaces, entrepreneurship programs, artrepreneurship integration, and project-based learning that emphasizes "conundrums" over rote memorization.',
  2,
  true
)
ON CONFLICT (persona_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  full_text = EXCLUDED.full_text,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active;

-- Update or insert "Heritage Guardian" persona
INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
VALUES (
  'heritage_guardian',
  'The Heritage Guardian',
  'Established regional families valuing Episcopal tradition, social networking, and ethical leadership.',
  'Long-time regional families who value tradition, character education, and institutional heritage. These families often have multi-generational connections to the school and view it as a steward of community values. They prioritize Episcopal traditions, ethical leadership development, and the social networks that private schools cultivate. Key decision factors include: character education programs, Episcopal identity, alumni legacy, financial accessibility through indexed tuition, and the school''s role as a community anchor.',
  3,
  true
)
ON CONFLICT (persona_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  full_text = EXCLUDED.full_text,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active;

-- Deactivate old real estate personas if they exist
UPDATE matrix_personas SET active = false WHERE persona_id IN ('move_up', 'retiree', 'luxury', 'first_time');

-- ============================================
-- 2. Update existing stages for SSES
-- ============================================

-- Update or insert "Discover" stage
INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)
VALUES (
  'discover',
  'Discover',
  'Finding top-tier education in the Florida Gulf Coast region.',
  0,
  true,
  true,
  'discover',
  'discovery_rate'
)
ON CONFLICT (stage_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active,
  core_stage = EXCLUDED.core_stage,
  core_stage_mapping = EXCLUDED.core_stage_mapping,
  primary_metric = EXCLUDED.primary_metric;

-- Update or insert "Research" stage (was "consider")
INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)
VALUES (
  'research',
  'Culture & Curriculum',
  'Deep dive into innovation labs, neurodiversity support, and academic rigor.',
  1,
  true,
  true,
  'consider',
  'mention_rate'
)
ON CONFLICT (stage_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active,
  core_stage = EXCLUDED.core_stage,
  core_stage_mapping = EXCLUDED.core_stage_mapping,
  primary_metric = EXCLUDED.primary_metric;

-- Update or insert "Compare" stage
INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)
VALUES (
  'compare',
  'Benchmarking',
  'How SSES compares to ODA, Pine View, and national elite schools.',
  2,
  true,
  true,
  'compare',
  'win_rate'
)
ON CONFLICT (stage_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active,
  core_stage = EXCLUDED.core_stage,
  core_stage_mapping = EXCLUDED.core_stage_mapping,
  primary_metric = EXCLUDED.primary_metric;

-- Update or insert "Apply" stage (was "decide")
INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)
VALUES (
  'apply',
  'Affordability & ROI',
  'Evaluating indexed tuition, universal vouchers, and long-term network value.',
  3,
  true,
  true,
  'decide',
  'recommendation_rate'
)
ON CONFLICT (stage_id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active,
  core_stage = EXCLUDED.core_stage,
  core_stage_mapping = EXCLUDED.core_stage_mapping,
  primary_metric = EXCLUDED.primary_metric;

-- Deactivate old real estate stages if they exist (keep as inactive for historical data)
UPDATE matrix_stages SET active = false WHERE stage_id IN ('explore', 'consider');

-- ============================================
-- 3. Create new published version
-- ============================================

INSERT INTO matrix_config_versions (version, status, personas_json, stages_json, published_at)
SELECT
  (SELECT COALESCE(MAX(version), 0) + 1 FROM matrix_config_versions),
  'published',
  (SELECT jsonb_agg(jsonb_build_object(
    'id', p.persona_id,
    'label', p.label,
    'description', p.description,
    'fullText', p.full_text,
    'orderIndex', p.order_index,
    'active', p.active
  )) FROM matrix_personas p WHERE p.active = true ORDER BY p.order_index),
  (SELECT jsonb_agg(jsonb_build_object(
    'id', s.stage_id,
    'label', s.label,
    'description', s.description,
    'orderIndex', s.order_index,
    'active', s.active,
    'coreStage', s.core_stage,
    'coreStageMapping', s.core_stage_mapping,
    'primaryMetric', s.primary_metric
  )) FROM matrix_stages s WHERE s.active = true ORDER BY s.order_index),
  NOW()
ON CONFLICT DO NOTHING; -- This is a simple insert, conflict unlikely

-- ============================================
-- 4. Update entity categories for SSES
-- ============================================

-- Ensure SSES-specific entity categories exist
INSERT INTO matrix_entity_categories (id, label, description, display_order, active)
VALUES
  ('innovation', 'Innovation Labs', 'STEAM Center, Mini Xerox PARC, Artrepreneurship facilities', 0, true),
  ('neurodiversity', 'Learning Capital', 'Vibrant Anomaly, ADHD support, gifted programs', 1, true),
  ('community', 'Social Ecosystem', 'Lakewood Ranch, Sarasota Yacht Club, Episcopal values', 2, true),
  ('financials', 'Fiscal Architecture', 'Indexed Tuition, Universal Vouchers, scholarships', 3, true),
  ('outcomes', 'Leadership Heritage', 'College placement, alumni network, entrepreneurial success', 4, true)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  active = EXCLUDED.active;

-- Add SSES-specific entity terms
INSERT INTO matrix_entity_terms (canonical_name, category_id, active, display_order) VALUES
-- Innovation Labs
('STEAM Center', 'innovation', true, 0),
('Mini Xerox PARC', 'innovation', true, 1),
('Artrepreneurship', 'innovation', true, 2),
('3D Printing', 'innovation', true, 3),
('Maker Space', 'innovation', true, 4),
('Innovation Labs', 'innovation', true, 5),

-- Neurodiversity
('Vibrant Anomaly', 'neurodiversity', true, 0),
('Twice Exceptional', 'neurodiversity', true, 1),
('2e Students', 'neurodiversity', true, 2),
('ADHD Support', 'neurodiversity', true, 3),
('Gifted Program', 'neurodiversity', true, 4),
('Neurodiversity', 'neurodiversity', true, 5),
('Learning Differences', 'neurodiversity', true, 6),

-- Community
('Lakewood Ranch', 'community', true, 0),
('Sarasota Yacht Club', 'community', true, 1),
('Episcopal Values', 'community', true, 2),
('HNW Network', 'community', true, 3),
('Social Integration', 'community', true, 4),

-- Financials
('Indexed Tuition', 'financials', true, 0),
('Universal Vouchers', 'financials', true, 1),
('School Choice', 'financials', true, 2),
('Scholarships', 'financials', true, 3),
('Financial Aid', 'financials', true, 4),
('Family Empowerment Scholarship', 'financials', true, 5),

-- Outcomes
('College Placement', 'outcomes', true, 0),
('Alumni Network', 'outcomes', true, 1),
('Entrepreneurial Success', 'outcomes', true, 2),
('Ivy League Placement', 'outcomes', true, 3),
('University Admissions', 'outcomes', true, 4)
ON CONFLICT (canonical_name, category_id) DO UPDATE SET
  active = EXCLUDED.active,
  display_order = EXCLUDED.display_order;

DO $$
BEGIN
  RAISE NOTICE 'Migration 006 complete: Updated SSES personas and stages';
  RAISE NOTICE 'Personas: wealthy_migrant, neurodivergent_advocate, innovation_seeker, heritage_guardian';
  RAISE NOTICE 'Stages: discover, research, compare, apply';
  RAISE NOTICE 'Entity categories and terms updated for SSES';
END $$;
