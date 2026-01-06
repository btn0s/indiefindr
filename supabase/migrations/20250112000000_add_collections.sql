-- Migration: Add collections feature
-- 
-- Creates three tables:
-- 1. collections - stores collection metadata (title, slug, description)
-- 2. collection_games - join table for games in collections (with ordering)
-- 3. collection_pins - explicit pin placements (home page or per-game)

-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create collection_games join table (membership + ordering)
CREATE TABLE IF NOT EXISTS collection_games (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  appid BIGINT NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, appid)
);

-- Create collection_pins table (explicit pin placements)
CREATE TABLE IF NOT EXISTS collection_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  context TEXT NOT NULL CHECK (context IN ('home', 'game')),
  game_appid BIGINT NULL REFERENCES games_new(appid) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure game_appid is provided when context is 'game'
  CONSTRAINT collection_pins_game_appid_check CHECK (
    (context = 'game' AND game_appid IS NOT NULL) OR
    (context = 'home' AND game_appid IS NULL)
  )
);

-- Create indexes for collections
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_published ON collections(published);

-- Create indexes for collection_games
CREATE INDEX IF NOT EXISTS idx_collection_games_collection_position ON collection_games(collection_id, position);
CREATE INDEX IF NOT EXISTS idx_collection_games_appid ON collection_games(appid);

-- Create indexes for collection_pins
CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_pins_unique ON collection_pins(context, COALESCE(game_appid, 0), collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_pins_context_position ON collection_pins(context, position);
CREATE INDEX IF NOT EXISTS idx_collection_pins_context_game_position ON collection_pins(context, game_appid, position);

-- Create trigger for updated_at on collections
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_pins ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Read-only access for public (admin manages via Supabase dashboard)
-- Collections: only published collections are visible
CREATE POLICY "Allow public read access to published collections" ON collections
  FOR SELECT USING (published = true);

-- Collection games: visible if the collection is published
CREATE POLICY "Allow public read access to collection games" ON collection_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_games.collection_id
      AND collections.published = true
    )
  );

-- Collection pins: visible if the collection is published
CREATE POLICY "Allow public read access to collection pins" ON collection_pins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_pins.collection_id
      AND collections.published = true
    )
  );
