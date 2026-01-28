-- Create batch_jobs table for cron batch tracking (Anthropic only)

CREATE TABLE IF NOT EXISTS batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES runs(id),
  provider TEXT NOT NULL,
  batch_type TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  request_count INT,
  input_file_id TEXT,
  output_file_id TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_run_id ON batch_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_provider_status ON batch_jobs(provider, status);
