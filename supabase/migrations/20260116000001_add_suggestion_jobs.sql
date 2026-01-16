-- Migration: Add suggestion_jobs table for async suggestion generation
-- 
-- Creates a job queue table to track suggestion generation jobs:
-- - Allows async processing without blocking page renders
-- - Supports polling for job status
-- - Ensures idempotency per source_appid

CREATE TABLE IF NOT EXISTS suggestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_appid BIGINT NOT NULL UNIQUE REFERENCES games_new(appid) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Create indexes for efficient job queries
CREATE INDEX IF NOT EXISTS idx_suggestion_jobs_status ON suggestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_suggestion_jobs_updated_at ON suggestion_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_suggestion_jobs_source_appid ON suggestion_jobs(source_appid);

-- Create trigger for updated_at
CREATE TRIGGER update_suggestion_jobs_updated_at
  BEFORE UPDATE ON suggestion_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE suggestion_jobs ENABLE ROW LEVEL SECURITY;

-- Allow public read access (needed for polling)
CREATE POLICY "Allow public read access to suggestion_jobs" ON suggestion_jobs
  FOR SELECT USING (true);

-- Note: Service role (used by API routes and workers) bypasses RLS automatically
-- No additional policies needed for service role operations
