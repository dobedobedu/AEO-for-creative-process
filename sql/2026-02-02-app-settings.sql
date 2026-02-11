-- ⚠️ DEPRECATED: This file is no longer the source of truth.
-- Use `supabase/migrations/` and the Supabase CLI workflow instead.
-- See docs/SSES-DEPLOYMENT-GUIDE.md for canonical process.
-- Canonical migration: supabase/migrations/20240101000010_app_settings.sql

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);
