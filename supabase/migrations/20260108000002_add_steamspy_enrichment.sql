-- Add SteamSpy enrichment columns to games_new for tag-based suggestions
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_tags JSONB DEFAULT '{}';
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_owners TEXT;
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_positive INTEGER;
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_negative INTEGER;
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_games_new_steamspy_updated_at 
  ON games_new(steamspy_updated_at) 
  WHERE steamspy_updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_new_steamspy_tags 
  ON games_new USING GIN (steamspy_tags);
