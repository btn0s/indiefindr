-- Add full-text search column and index to games_new
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_games_new_search ON games_new USING gin(search_vector);

-- Function to search games with full-text search
CREATE OR REPLACE FUNCTION search_games(
  search_query text,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  appid bigint,
  title text,
  header_image text,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.appid,
    g.title,
    g.header_image,
    ts_rank(g.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM games_new g
  WHERE g.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
