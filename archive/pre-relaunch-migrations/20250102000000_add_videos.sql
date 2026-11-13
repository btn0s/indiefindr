-- Add videos column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS videos JSONB; -- array of video URLs

-- Drop existing function to recreate with new return type
DROP FUNCTION IF EXISTS get_related_games(BIGINT, TEXT, INTEGER, DOUBLE PRECISION);

-- Update RPC function to return videos
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
  videos JSONB,
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
          g.videos,
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
          g.videos,
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
          g.videos,
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
