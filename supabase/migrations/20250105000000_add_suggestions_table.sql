-- Create suggestions table for storing Perplexity search results
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_appid BIGINT NOT NULL,
  result_text TEXT NOT NULL,
  usage_stats JSONB, -- {inputTokens, outputTokens, totalTokens}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on steam_appid for fast lookups
CREATE INDEX IF NOT EXISTS idx_suggestions_steam_appid ON suggestions(steam_appid);

-- Create unique constraint to prevent duplicate suggestions per app
CREATE UNIQUE INDEX IF NOT EXISTS idx_suggestions_steam_appid_unique ON suggestions(steam_appid);

-- Create trigger for updated_at
CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to suggestions
CREATE POLICY "Allow public read access to suggestions" ON suggestions
  FOR SELECT USING (true);

-- Allow public insert/update access to suggestions
CREATE POLICY "Allow public insert/update to suggestions" ON suggestions
  FOR ALL USING (true);
