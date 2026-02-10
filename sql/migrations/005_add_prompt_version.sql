-- Migration 005: Add prompt version tracking to runs
-- Purpose: Track which prompt version was used for each run
-- Run: psql $DATABASE_URL -f sql/migrations/005_add_prompt_version.sql

-- Add prompt_version column to runs table
ALTER TABLE runs
ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(64);

-- Add comment
COMMENT ON COLUMN runs.prompt_version IS 'Version/hash of prompts used when run was created (for replay/comparison)';

-- Create an index for filtering by prompt version
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_runs_prompt_version
ON runs(prompt_version)
WHERE prompt_version IS NOT NULL;

-- Create tenant_prompts table for Phase 2 (versioned prompt storage)
CREATE TABLE IF NOT EXISTS tenant_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant_configs(id),
  prompt_type VARCHAR(50) NOT NULL,  -- 'query-generation', 'extraction', 'chat'
  prompt_name VARCHAR(100) NOT NULL,  -- 'system', 'explore', etc.
  prompt_content TEXT NOT NULL,
  version VARCHAR(64) NOT NULL,  -- Hash or version number
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  UNIQUE(tenant_id, prompt_type, prompt_name, version)
);

-- Indexes for tenant_prompts
CREATE INDEX IF NOT EXISTS idx_tenant_prompts_tenant ON tenant_prompts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_prompts_active ON tenant_prompts(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tenant_prompts_type_name ON tenant_prompts(tenant_id, prompt_type, prompt_name);

-- Comments
COMMENT ON TABLE tenant_prompts IS 'Versioned prompt storage for tenant customization';
COMMENT ON COLUMN tenant_prompts.version IS 'Hash or version number of prompt content';
COMMENT ON COLUMN tenant_prompts.is_active IS 'Whether this version is currently active';

DO $$
BEGIN
  RAISE NOTICE 'Migration 005 complete: Added prompt version tracking';
END $$;
