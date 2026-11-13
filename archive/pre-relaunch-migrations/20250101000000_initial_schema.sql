-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id BIGINT PRIMARY KEY, -- Steam AppID
  name TEXT NOT NULL,
  description TEXT,
  header_image TEXT,
  screenshots JSONB, -- array of urls
  tags JSONB, -- tag -> weight
  review_summary JSONB,
  aesthetic_text TEXT,
  gameplay_text TEXT,
  narrative_text TEXT,
  aesthetic_embedding vector(1536),
  gameplay_embedding vector(1536),
  narrative_embedding vector(1536),
  vision_model TEXT, -- provider/model format
  embedding_model TEXT, -- provider/model format
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ingest_jobs table
CREATE TABLE IF NOT EXISTS ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_url TEXT NOT NULL,
  steam_appid BIGINT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
CREATE INDEX IF NOT EXISTS idx_games_aesthetic_embedding ON games USING ivfflat (aesthetic_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_games_gameplay_embedding ON games USING ivfflat (gameplay_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_games_narrative_embedding ON games USING ivfflat (narrative_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_status ON ingest_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_steam_appid ON ingest_jobs(steam_appid);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingest_jobs_updated_at
  BEFORE UPDATE ON ingest_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create RPC function for similarity queries
CREATE OR REPLACE FUNCTION get_related_games(
  p_appid BIGINT,
  p_facet TEXT,
  p_limit INTEGER DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  appid BIGINT,
  name TEXT,
  header_image TEXT,
  similarity FLOAT
) AS $$
DECLARE
  v_embedding vector(1536);
BEGIN
  -- Get the embedding for the specified facet
  CASE p_facet
    WHEN 'aesthetic' THEN
      SELECT aesthetic_embedding INTO v_embedding FROM games WHERE id = p_appid;
    WHEN 'gameplay' THEN
      SELECT gameplay_embedding INTO v_embedding FROM games WHERE id = p_appid;
    WHEN 'narrative' THEN
      SELECT narrative_embedding INTO v_embedding FROM games WHERE id = p_appid;
    ELSE
      RAISE EXCEPTION 'Invalid facet: %. Must be one of: aesthetic, gameplay, narrative', p_facet;
  END CASE;

  -- Return if no embedding found
  IF v_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Return similar games using cosine similarity
  CASE p_facet
    WHEN 'aesthetic' THEN
      RETURN QUERY
        SELECT 
          g.id AS appid,
          g.name,
          g.header_image,
          1 - (g.aesthetic_embedding <=> v_embedding) AS similarity
        FROM games g
        WHERE g.id != p_appid
          AND g.aesthetic_embedding IS NOT NULL
          AND (1 - (g.aesthetic_embedding <=> v_embedding)) >= p_threshold
        ORDER BY g.aesthetic_embedding <=> v_embedding
        LIMIT p_limit;
    WHEN 'gameplay' THEN
      RETURN QUERY
        SELECT 
          g.id AS appid,
          g.name,
          g.header_image,
          1 - (g.gameplay_embedding <=> v_embedding) AS similarity
        FROM games g
        WHERE g.id != p_appid
          AND g.gameplay_embedding IS NOT NULL
          AND (1 - (g.gameplay_embedding <=> v_embedding)) >= p_threshold
        ORDER BY g.gameplay_embedding <=> v_embedding
        LIMIT p_limit;
    WHEN 'narrative' THEN
      RETURN QUERY
        SELECT 
          g.id AS appid,
          g.name,
          g.header_image,
          1 - (g.narrative_embedding <=> v_embedding) AS similarity
        FROM games g
        WHERE g.id != p_appid
          AND g.narrative_embedding IS NOT NULL
          AND (1 - (g.narrative_embedding <=> v_embedding)) >= p_threshold
        ORDER BY g.narrative_embedding <=> v_embedding
        LIMIT p_limit;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to games
CREATE POLICY "Allow public read access to games" ON games
  FOR SELECT USING (true);

-- Allow public insert/update access to games (for ingestion)
CREATE POLICY "Allow public insert/update to games" ON games
  FOR ALL USING (true);

-- Allow public read access to ingest_jobs
CREATE POLICY "Allow public read access to ingest_jobs" ON ingest_jobs
  FOR SELECT USING (true);

-- Allow public insert/update access to ingest_jobs (for ingestion tracking)
CREATE POLICY "Allow public insert/update to ingest_jobs" ON ingest_jobs
  FOR ALL USING (true);
