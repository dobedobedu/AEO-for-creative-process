-- ⚠️ DEPRECATED: This file is no longer the source of truth.
-- Use `supabase/migrations/` and the Supabase CLI workflow instead.
-- See docs/SSES-DEPLOYMENT-GUIDE.md for canonical process.
-- Canonical migration: supabase/migrations/20240101000012_multi_tenant_columns.sql

-- Migration 002: Create tenant_configs table and default tenant
-- Purpose: Store tenant configuration in database (Phase 2 preparation)
-- Run: psql $DATABASE_URL -f sql/migrations/002_create_tenant_configs.sql

-- Create tenant_configs table
CREATE TABLE IF NOT EXISTS tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(50) NOT NULL UNIQUE,
  tenant_name VARCHAR(255) NOT NULL,
  industry VARCHAR(50) NOT NULL DEFAULT 'other',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_configs_slug ON tenant_configs(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_configs_industry ON tenant_configs(industry);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_configs_updated_at ON tenant_configs;
CREATE TRIGGER tenant_configs_updated_at
  BEFORE UPDATE ON tenant_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_configs_updated_at();

-- Insert default tenant (used for backward compatibility)
INSERT INTO tenant_configs (id, tenant_slug, tenant_name, industry, config_json)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Default Tenant',
  'real_estate',
  '{}'::jsonb
)
ON CONFLICT (tenant_slug) DO NOTHING;

-- Add comments
COMMENT ON TABLE tenant_configs IS 'Stores tenant configuration for multi-tenant deployments';
COMMENT ON COLUMN tenant_configs.tenant_slug IS 'URL-friendly unique identifier for tenant';
COMMENT ON COLUMN tenant_configs.config_json IS 'Full tenant configuration (mirrors config/tenant.json structure)';

DO $$
BEGIN
  RAISE NOTICE 'Migration 002 complete: Created tenant_configs table with default tenant';
END $$;
