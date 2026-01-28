-- Add generated_queries_at for daily query refresh tracking
ALTER TABLE intents ADD COLUMN IF NOT EXISTS generated_queries_at TIMESTAMPTZ;
