-- Drop unused suggestions columns
ALTER TABLE games_new 
  DROP COLUMN IF EXISTS suggestions_result_text,
  DROP COLUMN IF EXISTS suggestions_usage_stats;
