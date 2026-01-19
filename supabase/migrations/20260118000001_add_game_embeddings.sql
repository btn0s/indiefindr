-- Migration: Add game embeddings infrastructure for v2
-- Description: Creates tables and functions for multi-facet embedding-based recommendations

-- Enable vector extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Main embeddings table
CREATE TABLE IF NOT EXISTS game_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to games
  appid INTEGER NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,

  -- Facet type
  facet TEXT NOT NULL CHECK (facet IN (
    'aesthetic',   -- Visual style from screenshots
    'atmosphere',  -- Emotional mood/vibe
    'mechanics',   -- Gameplay patterns
    'narrative',   -- Theme and story
    'dynamics'     -- Pacing and feel
  )),

  -- The embedding vector (768 dimensions for SigLIP compatibility)
  embedding vector(768) NOT NULL,

  -- Model tracking for reproducibility
  embedding_model TEXT NOT NULL DEFAULT 'siglip2-base-patch16-224',
  embedding_version INTEGER NOT NULL DEFAULT 1,

  -- Source data tracking (for debugging and regeneration)
  source_type TEXT NOT NULL CHECK (source_type IN (
    'image',      -- From screenshots/images
    'text',       -- From text templates
    'multimodal', -- Combined image + text
    'video'       -- From video analysis
  )),
  source_data JSONB,  -- URLs, text snippets, etc.

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one embedding per facet per game
  UNIQUE(appid, facet)
);

-- IGDB enrichment data
CREATE TABLE IF NOT EXISTS game_igdb_data (
  appid INTEGER PRIMARY KEY REFERENCES games_new(appid) ON DELETE CASCADE,
  igdb_id INTEGER,
  themes TEXT[],              -- ['Horror', 'Sci-fi', 'Mystery']
  keywords TEXT[],            -- ['Procedural', 'Permadeath', 'Crafting']
  player_perspectives TEXT[], -- ['Side view', 'First person', 'Bird view']
  game_modes TEXT[],          -- ['Single player', 'Co-operative']
  game_engines TEXT[],        -- ['Unity', 'Unreal Engine']
  storyline TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Basic indexes for lookups
CREATE INDEX IF NOT EXISTS game_embeddings_appid_idx ON game_embeddings(appid);
CREATE INDEX IF NOT EXISTS game_embeddings_facet_idx ON game_embeddings(facet);

-- GIN indexes for IGDB array fields
CREATE INDEX IF NOT EXISTS game_igdb_data_themes_idx ON game_igdb_data USING GIN (themes);
CREATE INDEX IF NOT EXISTS game_igdb_data_keywords_idx ON game_igdb_data USING GIN (keywords);

-- HNSW indexes for vector similarity search (per-facet for filtered queries)
-- Using cosine distance operator
CREATE INDEX IF NOT EXISTS game_embeddings_aesthetic_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'aesthetic';

CREATE INDEX IF NOT EXISTS game_embeddings_atmosphere_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'atmosphere';

CREATE INDEX IF NOT EXISTS game_embeddings_mechanics_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'mechanics';

CREATE INDEX IF NOT EXISTS game_embeddings_narrative_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'narrative';

CREATE INDEX IF NOT EXISTS game_embeddings_dynamics_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'dynamics';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp trigger function (may already exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to game_embeddings
DROP TRIGGER IF EXISTS update_game_embeddings_updated_at ON game_embeddings;
CREATE TRIGGER update_game_embeddings_updated_at
  BEFORE UPDATE ON game_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE game_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_igdb_data ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for game_embeddings"
  ON game_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Public read access for game_igdb_data"
  ON game_igdb_data FOR SELECT
  USING (true);

-- Service role write access
CREATE POLICY "Service role write access for game_embeddings"
  ON game_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role write access for game_igdb_data"
  ON game_igdb_data FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Find similar games by a single facet
CREATE OR REPLACE FUNCTION find_similar_games(
  p_appid INTEGER,
  p_facet TEXT,
  p_limit INTEGER DEFAULT 12,
  p_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  out_appid INTEGER,
  out_title TEXT,
  out_header_image TEXT,
  out_similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  source_embedding vector(768);
BEGIN
  -- Validate facet
  IF p_facet NOT IN ('aesthetic', 'atmosphere', 'mechanics', 'narrative', 'dynamics') THEN
    RAISE EXCEPTION 'Invalid facet: %. Must be one of: aesthetic, atmosphere, mechanics, narrative, dynamics', p_facet;
  END IF;

  -- Get source game's embedding for this facet
  SELECT ge.embedding INTO source_embedding
  FROM game_embeddings ge
  WHERE ge.appid = p_appid AND ge.facet = p_facet;

  -- Return empty if no embedding found
  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Find similar games using cosine similarity
  -- Note: <=> is cosine distance, so 1 - distance = similarity
  RETURN QUERY
  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    (1 - (ge.embedding <=> source_embedding))::FLOAT AS similarity
  FROM game_embeddings ge
  JOIN games_new g ON g.appid = ge.appid
  WHERE ge.facet = p_facet
    AND ge.appid != p_appid
    AND (1 - (ge.embedding <=> source_embedding)) >= p_threshold
  ORDER BY ge.embedding <=> source_embedding
  LIMIT p_limit;
END;
$$;

-- Find similar games with weighted multi-facet matching
CREATE OR REPLACE FUNCTION find_similar_games_weighted(
  p_appid INTEGER,
  p_weights JSONB,  -- {"aesthetic": 0.3, "mechanics": 0.4, "narrative": 0.3}
  p_limit INTEGER DEFAULT 12,
  p_threshold FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  out_appid INTEGER,
  out_title TEXT,
  out_header_image TEXT,
  out_weighted_similarity FLOAT,
  out_facet_scores JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Get source game's embeddings for requested facets
  source_embeddings AS (
    SELECT ge.facet, ge.embedding
    FROM game_embeddings ge
    WHERE ge.appid = p_appid
      AND ge.facet IN (SELECT jsonb_object_keys(p_weights))
  ),

  -- Calculate similarity for each game and facet
  similarities AS (
    SELECT
      ge.appid AS sim_appid,
      ge.facet,
      1 - (ge.embedding <=> se.embedding) AS similarity
    FROM game_embeddings ge
    JOIN source_embeddings se ON ge.facet = se.facet
    WHERE ge.appid != p_appid
  ),

  -- Compute weighted average
  weighted AS (
    SELECT
      s.sim_appid,
      -- Weighted average similarity
      SUM(s.similarity * COALESCE((p_weights->>s.facet)::FLOAT, 0)) /
        NULLIF(SUM(COALESCE((p_weights->>s.facet)::FLOAT, 0)), 0) AS weighted_sim,
      -- Individual facet scores for UI display
      jsonb_object_agg(s.facet, ROUND(s.similarity::NUMERIC, 3)) AS scores
    FROM similarities s
    GROUP BY s.sim_appid
  )

  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    w.weighted_sim::FLOAT,
    w.scores
  FROM weighted w
  JOIN games_new g ON g.appid = w.sim_appid
  WHERE w.weighted_sim >= p_threshold
  ORDER BY w.weighted_sim DESC
  LIMIT p_limit;
END;
$$;

-- Search games using a raw embedding vector (for text-to-game or image-to-game search)
CREATE OR REPLACE FUNCTION search_games_by_embedding(
  p_query_embedding vector(768),
  p_facet TEXT,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  appid INTEGER,
  title TEXT,
  header_image TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Validate facet
  IF p_facet NOT IN ('aesthetic', 'atmosphere', 'mechanics', 'narrative', 'dynamics') THEN
    RAISE EXCEPTION 'Invalid facet: %. Must be one of: aesthetic, atmosphere, mechanics, narrative, dynamics', p_facet;
  END IF;

  RETURN QUERY
  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    (1 - (ge.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM game_embeddings ge
  JOIN games_new g ON g.appid = ge.appid
  WHERE ge.facet = p_facet
  ORDER BY ge.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Utility: Get embedding coverage statistics
CREATE OR REPLACE FUNCTION get_embedding_coverage()
RETURNS TABLE (
  facet TEXT,
  game_count BIGINT,
  total_games BIGINT,
  coverage_pct FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH total AS (
    SELECT COUNT(*) as total FROM games_new
  ),
  by_facet AS (
    SELECT ge.facet, COUNT(DISTINCT ge.appid) as count
    FROM game_embeddings ge
    GROUP BY ge.facet
  )
  SELECT
    f.facet,
    f.count,
    t.total,
    ROUND((f.count::FLOAT / NULLIF(t.total, 0) * 100)::NUMERIC, 1)::FLOAT
  FROM by_facet f
  CROSS JOIN total t
  ORDER BY f.facet;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION find_similar_games TO authenticated, anon;
GRANT EXECUTE ON FUNCTION find_similar_games_weighted TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_games_by_embedding TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_embedding_coverage TO authenticated, anon;
