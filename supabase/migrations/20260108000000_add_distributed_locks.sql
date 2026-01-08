-- Distributed locks table for cross-process coordination
-- Used to replace in-memory Sets for multi-instance deployments (Vercel, etc.)

CREATE TABLE IF NOT EXISTS distributed_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lock_key TEXT NOT NULL UNIQUE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for efficient expiry cleanup
CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires_at ON distributed_locks(expires_at);

-- Note: lock_key already has a UNIQUE constraint which creates an index, so we don't need a separate index

-- Enable RLS
ALTER TABLE distributed_locks ENABLE ROW LEVEL SECURITY;

-- Allow all operations on distributed_locks (used for cross-process coordination)
-- This is intentionally permissive as locks need to be accessible across instances
CREATE POLICY "Allow all operations on distributed_locks" ON distributed_locks
    FOR ALL USING (true) WITH CHECK (true);

-- Automatic cleanup of expired locks (runs every minute via pg_cron if available)
-- If pg_cron is not available, expired locks are cleaned up on acquire attempts
COMMENT ON TABLE distributed_locks IS 'Distributed locks for cross-process coordination. Locks auto-expire based on expires_at.';
