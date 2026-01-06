-- Rate limiter table for global rate limiting across processes
-- Uses a single row per rate limit key to track last request time

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);

-- Insert default Steam rate limit entry
INSERT INTO rate_limits (key, last_request_at) 
VALUES ('steam_api', NOW() - INTERVAL '1 hour')
ON CONFLICT (key) DO NOTHING;
