-- Add Steam metadata fields for filtering (DLC, NSFW, etc.)
ALTER TABLE games ADD COLUMN IF NOT EXISTS steam_type TEXT; -- 'game', 'dlc', 'adult', etc.
ALTER TABLE games ADD COLUMN IF NOT EXISTS steam_required_age INTEGER; -- Age rating (0, 3, 7, 12, 16, 17, 18)
ALTER TABLE games ADD COLUMN IF NOT EXISTS steam_categories JSONB; -- Array of {id: number, description: string}

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_games_steam_type ON games(steam_type);
CREATE INDEX IF NOT EXISTS idx_games_steam_required_age ON games(steam_required_age);
CREATE INDEX IF NOT EXISTS idx_games_steam_categories ON games USING GIN (steam_categories);

-- Add comment for documentation
COMMENT ON COLUMN games.steam_type IS 'Steam app type: game, dlc, etc.';
COMMENT ON COLUMN games.steam_required_age IS 'Steam age rating: 0, 3, 7, 12, 16, 17, 18';
COMMENT ON COLUMN games.steam_categories IS 'Steam categories array with id and description for filtering (DLC, NSFW, etc.)';
