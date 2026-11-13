-- Add suggested_game_appids column to store validated app IDs
ALTER TABLE games_new 
  ADD COLUMN IF NOT EXISTS suggested_game_appids JSONB; -- Array of validated app IDs [123, 456, 789]

-- Create index for fast lookups when checking if a game is suggested
CREATE INDEX IF NOT EXISTS idx_games_new_suggested_appids ON games_new USING GIN (suggested_game_appids);
