-- Migration: Supabase Auth + DB-Backed Progress
-- Date: January 20, 2026
-- Purpose: Add user attribution columns and run_progress table

-- ============================================
-- 1. Add user attribution columns to intents
-- ============================================

-- Add created_by column (UUID references auth.users)
ALTER TABLE intents
ADD COLUMN IF NOT EXISTS created_by UUID NULL;

-- Add updated_by column (UUID references auth.users)
ALTER TABLE intents
ADD COLUMN IF NOT EXISTS updated_by UUID NULL;

-- Add updated_at column for tracking last modification
ALTER TABLE intents
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- 2. Add user attribution to intent_history
-- ============================================

-- Add actor_user_id to track who made changes
ALTER TABLE intent_history
ADD COLUMN IF NOT EXISTS actor_user_id UUID NULL;

-- ============================================
-- 3. Create run_progress table
-- ============================================

CREATE TABLE IF NOT EXISTS run_progress (
  run_id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'error')),
  total_steps INT NOT NULL,
  completed_steps INT NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'queries' CHECK (unit IN ('queries', 'cells', 'items')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  events JSONB DEFAULT '[]'::jsonb,
  -- Optional: track who started the run
  started_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for finding active runs
CREATE INDEX IF NOT EXISTS idx_run_progress_status ON run_progress(status);

-- Index for cleanup of old runs
CREATE INDEX IF NOT EXISTS idx_run_progress_updated_at ON run_progress(updated_at);

-- ============================================
-- 4. Create trigger for updated_at on intents
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for intents table
DROP TRIGGER IF EXISTS update_intents_updated_at ON intents;
CREATE TRIGGER update_intents_updated_at
  BEFORE UPDATE ON intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Grant permissions (if using RLS later)
-- ============================================

-- For now, we use server-only access via connection string
-- No RLS policies needed yet

-- ============================================
-- 6. Cleanup function for old progress entries
-- ============================================

-- Function to clean up progress entries older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_progress()
RETURNS void AS $$
BEGIN
  DELETE FROM run_progress
  WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND status IN ('complete', 'error');
END;
$$ LANGUAGE plpgsql;

-- Note: Call this periodically via cron or scheduled function
-- Example: SELECT cleanup_old_progress();
