-- Migration: Update suggested_game_appids structure to include explanations
-- 
-- Previous format: [123, 456, 789] (array of app IDs)
-- New format: [{appId: 123, explanation: "..."}, ...] (array of objects)
--
-- This is a backwards-compatible change since the column is already JSONB.
-- The application code handles the new structure.
-- 
-- To re-populate with explanations, run a script to re-ingest all games.

-- No schema changes needed - the column is already JSONB and can store any JSON structure.
-- This migration serves as documentation of the data format change.

COMMENT ON COLUMN games_new.suggested_game_appids IS 'Array of suggestion objects: [{appId: number, explanation: string}, ...]';
