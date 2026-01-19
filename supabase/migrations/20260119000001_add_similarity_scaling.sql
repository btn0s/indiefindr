-- Migration: Add temperature scaling to similarity functions
-- Temperature scaling spreads out compressed cosine similarities for better discrimination

-- Configuration for per-facet scaling parameters
-- center: the typical midpoint of raw similarities for this facet
-- temperature: multiplier to spread similarities (higher = more spread)
CREATE OR REPLACE FUNCTION get_facet_scaling_params()
RETURNS TABLE (
  facet TEXT,
  center FLOAT,
  temperature FLOAT
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('aesthetic', 0.68, 3.0),
    ('atmosphere', 0.85, 3.0),
    ('mechanics', 0.78, 3.0),
    ('narrative', 0.57, 2.0),
    ('dynamics', 0.70, 2.5)
  ) AS t(facet, center, temperature);
$$;

-- Scale a raw similarity using temperature scaling
-- Formula: scaled = (raw - center) * temperature + center, clamped to [0, 1]
CREATE OR REPLACE FUNCTION scale_similarity(
  raw_sim FLOAT,
  center FLOAT,
  temperature FLOAT
)
RETURNS FLOAT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0.0, LEAST(1.0, (raw_sim - center) * temperature + center));
$$;

CREATE OR REPLACE FUNCTION find_similar_games_weighted(
  p_appid INTEGER,
  p_weights JSONB,
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
  -- Get scaling parameters
  scaling AS (
    SELECT * FROM get_facet_scaling_params()
  ),
  
  -- Get source game's embeddings for requested facets
  source_embeddings AS (
    SELECT ge.facet, ge.embedding
    FROM game_embeddings ge
    WHERE ge.appid = p_appid
      AND ge.facet IN (SELECT jsonb_object_keys(p_weights))
  ),

  -- Calculate raw similarity for each game and facet
  raw_similarities AS (
    SELECT
      ge.appid AS sim_appid,
      ge.facet,
      1 - (ge.embedding <=> se.embedding) AS raw_similarity
    FROM game_embeddings ge
    JOIN source_embeddings se ON ge.facet = se.facet
    WHERE ge.appid != p_appid
  ),
  
  -- Apply temperature scaling per facet
  scaled_similarities AS (
    SELECT
      rs.sim_appid,
      rs.facet,
      scale_similarity(
        rs.raw_similarity,
        COALESCE(sc.center, 0.7),
        COALESCE(sc.temperature, 2.0)
      ) AS similarity
    FROM raw_similarities rs
    LEFT JOIN scaling sc ON rs.facet = sc.facet
  ),

  -- Compute weighted average of scaled similarities
  weighted AS (
    SELECT
      s.sim_appid,
      SUM(s.similarity * COALESCE((p_weights->>s.facet)::FLOAT, 0)) /
        NULLIF(SUM(COALESCE((p_weights->>s.facet)::FLOAT, 0)), 0) AS weighted_sim,
      jsonb_object_agg(s.facet, ROUND(s.similarity::NUMERIC, 3)) AS scores
    FROM scaled_similarities s
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
  facet_center FLOAT;
  facet_temperature FLOAT;
BEGIN
  IF p_facet NOT IN ('aesthetic', 'atmosphere', 'mechanics', 'narrative', 'dynamics') THEN
    RAISE EXCEPTION 'Invalid facet: %. Must be one of: aesthetic, atmosphere, mechanics, narrative, dynamics', p_facet;
  END IF;

  SELECT ge.embedding INTO source_embedding
  FROM game_embeddings ge
  WHERE ge.appid = p_appid AND ge.facet = p_facet;

  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Get scaling parameters for this facet
  SELECT sp.center, sp.temperature INTO facet_center, facet_temperature
  FROM get_facet_scaling_params() sp
  WHERE sp.facet = p_facet;
  
  -- Default if not found
  facet_center := COALESCE(facet_center, 0.7);
  facet_temperature := COALESCE(facet_temperature, 2.0);

  RETURN QUERY
  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    scale_similarity(
      (1 - (ge.embedding <=> source_embedding))::FLOAT,
      facet_center,
      facet_temperature
    ) AS similarity
  FROM game_embeddings ge
  JOIN games_new g ON g.appid = ge.appid
  WHERE ge.facet = p_facet
    AND ge.appid != p_appid
    AND scale_similarity(
      (1 - (ge.embedding <=> source_embedding))::FLOAT,
      facet_center,
      facet_temperature
    ) >= p_threshold
  ORDER BY ge.embedding <=> source_embedding
  LIMIT p_limit;
END;
$$;
