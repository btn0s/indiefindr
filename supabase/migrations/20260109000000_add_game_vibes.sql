-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Table to store vibe summaries and embeddings for games
CREATE TABLE IF NOT EXISTS game_vibes (
  appid INTEGER PRIMARY KEY REFERENCES games_new(appid) ON DELETE CASCADE,
  vibe_summary TEXT NOT NULL,
  vibe_embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS game_vibes_embedding_idx 
  ON game_vibes USING ivfflat (vibe_embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Function to find similar games by vibe embedding
CREATE OR REPLACE FUNCTION find_similar_vibes(
  source_appid INTEGER,
  match_count INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  appid INTEGER,
  title TEXT,
  vibe_summary TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  source_embedding vector(1536);
BEGIN
  SELECT gv.vibe_embedding INTO source_embedding
  FROM game_vibes gv
  WHERE gv.appid = source_appid;

  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    gv.appid,
    g.title,
    gv.vibe_summary,
    1 - (gv.vibe_embedding <=> source_embedding) AS similarity
  FROM game_vibes gv
  JOIN games_new g ON g.appid = gv.appid
  WHERE gv.appid != source_appid
    AND gv.vibe_embedding IS NOT NULL
    AND 1 - (gv.vibe_embedding <=> source_embedding) >= similarity_threshold
  ORDER BY gv.vibe_embedding <=> source_embedding
  LIMIT match_count;
END;
$$;
