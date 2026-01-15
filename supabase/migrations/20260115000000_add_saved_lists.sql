-- Migration: Add saved lists feature for user accounts
-- 
-- Creates two tables:
-- 1. saved_lists - stores user's saved game lists (one default "Saved" list per user)
-- 2. saved_list_games - join table for games in saved lists
--
-- Also creates a trigger to automatically create a default "Saved" list when a user signs up

-- Create saved_lists table
CREATE TABLE IF NOT EXISTS saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Saved',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_list_games join table
CREATE TABLE IF NOT EXISTS saved_list_games (
  list_id UUID NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
  appid BIGINT NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (list_id, appid)
);

-- Create indexes for saved_lists
CREATE INDEX IF NOT EXISTS idx_saved_lists_owner_id ON saved_lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_saved_lists_owner_default ON saved_lists(owner_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_saved_lists_public ON saved_lists(is_public) WHERE is_public = true;

-- Create indexes for saved_list_games
CREATE INDEX IF NOT EXISTS idx_saved_list_games_list_id ON saved_list_games(list_id);
CREATE INDEX IF NOT EXISTS idx_saved_list_games_appid ON saved_list_games(appid);

-- Unique constraint: one default list per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_lists_one_default_per_user 
ON saved_lists(owner_id) 
WHERE is_default = true;

-- Create trigger for updated_at on saved_lists
CREATE TRIGGER update_saved_lists_updated_at
  BEFORE UPDATE ON saved_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on both tables
ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_list_games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_lists
-- Owners can do everything (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Allow owners full access to their saved lists" ON saved_lists
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Public can read lists that are marked as public
CREATE POLICY "Allow public read access to public saved lists" ON saved_lists
  FOR SELECT USING (is_public = true);

-- RLS Policies for saved_list_games
-- Owners can do everything for games in their lists
CREATE POLICY "Allow owners full access to their saved list games" ON saved_list_games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM saved_lists
      WHERE saved_lists.id = saved_list_games.list_id
      AND saved_lists.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_lists
      WHERE saved_lists.id = saved_list_games.list_id
      AND saved_lists.owner_id = auth.uid()
    )
  );

-- Public can read games from public lists
CREATE POLICY "Allow public read access to public saved list games" ON saved_list_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_lists
      WHERE saved_lists.id = saved_list_games.list_id
      AND saved_lists.is_public = true
    )
  );

-- Function to create default saved list for new users
CREATE OR REPLACE FUNCTION create_default_saved_list_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.saved_lists (owner_id, title, is_default, is_public)
  VALUES (NEW.id, 'Saved', true, true);
  RETURN NEW;
END;
$$;

-- Trigger to create default saved list when a user signs up
CREATE TRIGGER on_auth_user_created_create_default_saved_list
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_saved_list_for_user();
