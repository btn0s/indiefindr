-- Fix ambiguous column references in similarity functions
-- Must DROP first because return type is changing

DROP FUNCTION IF EXISTS find_similar_games(INTEGER, TEXT, INTEGER, FLOAT);
DROP FUNCTION IF EXISTS find_similar_games_weighted(INTEGER, JSONB, INTEGER, FLOAT);

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
  IF p_facet NOT IN ('aesthetic', 'atmosphere', 'mechanics', 'narrative', 'dynamics') THEN
    RAISE EXCEPTION 'Invalid facet: %', p_facet;
  END IF;

  SELECT ge.embedding INTO source_embedding
  FROM game_embeddings ge
  WHERE ge.appid = p_appid AND ge.facet = p_facet;

  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    (1 - (ge.embedding <=> source_embedding))::FLOAT
  FROM game_embeddings ge
  JOIN games_new g ON g.appid = ge.appid
  WHERE ge.facet = p_facet
    AND ge.appid != p_appid
    AND (1 - (ge.embedding <=> source_embedding)) >= p_threshold
  ORDER BY ge.embedding <=> source_embedding
  LIMIT p_limit;
END;
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
  source_embeddings AS (
    SELECT ge.facet, ge.embedding
    FROM game_embeddings ge
    WHERE ge.appid = p_appid
      AND ge.facet IN (SELECT jsonb_object_keys(p_weights))
  ),
  similarities AS (
    SELECT
      ge.appid AS sim_appid,
      ge.facet,
      1 - (ge.embedding <=> se.embedding) AS similarity
    FROM game_embeddings ge
    JOIN source_embeddings se ON ge.facet = se.facet
    WHERE ge.appid != p_appid
  ),
  weighted AS (
    SELECT
      s.sim_appid,
      SUM(s.similarity * COALESCE((p_weights->>s.facet)::FLOAT, 0)) /
        NULLIF(SUM(COALESCE((p_weights->>s.facet)::FLOAT, 0)), 0) AS weighted_sim,
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
