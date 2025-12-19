-- Create games_new table that mirrors the Steam data shape
CREATE TABLE IF NOT EXISTS games_new (
  appid BIGINT PRIMARY KEY,
  screenshots JSONB NOT NULL, -- array of strings
  videos JSONB NOT NULL, -- array of strings
  title TEXT NOT NULL,
  header_image TEXT,
  short_description TEXT,
  long_description TEXT,
  raw JSONB NOT NULL, -- Raw Steam API response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_games_new_title ON games_new(title);
CREATE INDEX IF NOT EXISTS idx_games_new_created_at ON games_new(created_at);

-- Create trigger for updated_at
CREATE TRIGGER update_games_new_updated_at
  BEFORE UPDATE ON games_new
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE games_new ENABLE ROW LEVEL SECURITY;

-- Allow public read access to games_new
CREATE POLICY "Allow public read access to games_new" ON games_new
  FOR SELECT USING (true);

-- Allow public insert/update access to games_new
CREATE POLICY "Allow public insert/update to games_new" ON games_new
  FOR ALL USING (true);
