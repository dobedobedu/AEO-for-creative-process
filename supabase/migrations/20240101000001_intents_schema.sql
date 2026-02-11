-- Intent library database schema for multi-user sync on Supabase/Vercel
-- Run this in your Supabase SQL Editor

-- Intent library metadata (single row for version tracking)
CREATE TABLE IF NOT EXISTS intent_library_meta (
  id INT PRIMARY KEY DEFAULT 1,
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Initialize metadata row
INSERT INTO intent_library_meta (id, version, updated_at)
VALUES (1, 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- Intents table with user attribution
CREATE TABLE IF NOT EXISTS intents (
  id TEXT PRIMARY KEY,
  persona TEXT NOT NULL,
  stage TEXT NOT NULL,
  text TEXT NOT NULL,
  default_queries JSONB,
  role TEXT DEFAULT 'cpo',
  query_style FLOAT DEFAULT 0.75,
  generated_queries JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- User attribution columns
  created_by UUID NULL,
  updated_by UUID NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- History table for audit trail with user attribution
CREATE TABLE IF NOT EXISTS intent_history (
  id SERIAL PRIMARY KEY,
  version INT NOT NULL,
  date DATE NOT NULL,
  changes JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actor_user_id UUID NULL
);

-- Run progress table for DB-backed progress tracking
CREATE TABLE IF NOT EXISTS run_progress (
  run_id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'error')),
  total_steps INT NOT NULL,
  completed_steps INT NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'queries' CHECK (unit IN ('queries', 'cells', 'items')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  events JSONB DEFAULT '[]'::jsonb,
  started_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_intents_persona_stage ON intents(persona, stage);
CREATE INDEX IF NOT EXISTS idx_intents_active ON intents(active);
CREATE INDEX IF NOT EXISTS idx_intent_history_version ON intent_history(version);
CREATE INDEX IF NOT EXISTS idx_run_progress_status ON run_progress(status);
CREATE INDEX IF NOT EXISTS idx_run_progress_updated_at ON run_progress(updated_at);

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

-- Function to clean up progress entries older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_progress()
RETURNS void AS $$
BEGIN
  DELETE FROM run_progress
  WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND status IN ('complete', 'error');
END;
$$ LANGUAGE plpgsql;
