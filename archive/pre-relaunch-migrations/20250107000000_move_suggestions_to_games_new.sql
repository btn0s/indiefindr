-- Move suggestions data from suggestions table to games_new table
-- Add columns to games_new
ALTER TABLE games_new 
  ADD COLUMN IF NOT EXISTS suggestions_result_text TEXT,
  ADD COLUMN IF NOT EXISTS suggestions_usage_stats JSONB;

-- Migrate existing suggestions data to games_new
UPDATE games_new
SET 
  suggestions_result_text = s.result_text,
  suggestions_usage_stats = s.usage_stats,
  updated_at = NOW()
FROM suggestions s
WHERE games_new.appid = s.steam_appid;

-- Drop the suggestions table (including indexes, triggers, and policies)
DROP TABLE IF EXISTS suggestions CASCADE;
