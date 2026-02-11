-- ⚠️ DEPRECATED: This file is no longer the source of truth.
-- Use `supabase/migrations/` and the Supabase CLI workflow instead.
-- See docs/SSES-DEPLOYMENT-GUIDE.md for canonical process.
-- Canonical migration: supabase/migrations/20240101000009_intents_gen_queries.sql

-- Add generated_queries_at for daily query refresh tracking
ALTER TABLE intents ADD COLUMN IF NOT EXISTS generated_queries_at TIMESTAMPTZ;
