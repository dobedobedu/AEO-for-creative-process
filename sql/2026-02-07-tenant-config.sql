-- Migration: Tenant Configuration
-- Date: February 7, 2026
-- Purpose: Add tenant_config table for storing white-label tenant configuration
--          (brand, competitors, geography, entity categories, providers, industry)

-- ============================================
-- 1. Create tenant_config table
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  brand_json JSONB NOT NULL DEFAULT '{}',
  competitors_json JSONB NOT NULL DEFAULT '[]',
  geography_json JSONB,
  entity_categories_json JSONB NOT NULL DEFAULT '[]',
  providers_json JSONB NOT NULL DEFAULT '{}',
  industry TEXT NOT NULL DEFAULT 'other',
  setup_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

-- ============================================
-- 2. Create trigger for updated_at
-- ============================================

-- Reuse the update_updated_at_column() function created in 2026-01-22-matrix-config.sql
-- Create it if it doesn't exist (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ language 'plpgsql';

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS update_tenant_config_updated_at ON tenant_config;

-- Create trigger
CREATE TRIGGER update_tenant_config_updated_at
  BEFORE UPDATE ON tenant_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Insert default row
-- ============================================

-- Ensure a default row exists so reads always succeed
INSERT INTO tenant_config (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Verification queries (commented out)
-- ============================================

-- Check tenant config
-- SELECT * FROM tenant_config;

-- Check default row exists
-- SELECT id, industry, setup_complete, created_at, updated_at FROM tenant_config WHERE id = 'default';
