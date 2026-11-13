-- Speed up home page ordering by avoiding per-request JSON parsing.
--
-- `games_new_home` was previously a (non-materialized) view that computed:
-- - suggestions_count (jsonb_array_length)
-- - steam_release_date (best-effort parse from raw JSON)
-- - is_indie (publisher/developer heuristic)
-- - home_bucket (uses CURRENT_DATE rolling window)
--
-- That forced a seq scan + per-row JSON parsing + sort on every request.
--
-- Fix:
-- - Store the immutable parts as STORED generated columns on `games_new`
-- - Make `games_new_home` a MATERIALIZED VIEW that computes the rolling bucket at refresh time
-- - Index the MV so ORDER BY ... LIMIT becomes an index scan

-- ============================================================================
-- Immutable derived fields as generated columns on base table
-- ============================================================================

ALTER TABLE public.games_new
ADD COLUMN IF NOT EXISTS suggestions_count integer
GENERATED ALWAYS AS (
  CASE
    WHEN jsonb_typeof(suggested_game_appids) = 'array' THEN jsonb_array_length(suggested_game_appids)
    ELSE 0
  END
) STORED;

ALTER TABLE public.games_new
ADD COLUMN IF NOT EXISTS steam_release_date date
GENERATED ALWAYS AS (
  public.steam_try_parse_release_date(raw->'release_date'->>'date')
) STORED;

ALTER TABLE public.games_new
ADD COLUMN IF NOT EXISTS is_indie boolean
GENERATED ALWAYS AS (
  public.steam_is_likely_indie(raw)
) STORED;

-- ============================================================================
-- Materialized view for home ordering (rolling window evaluated at refresh time)
-- ============================================================================

DROP VIEW IF EXISTS public.games_new_home;
DROP MATERIALIZED VIEW IF EXISTS public.games_new_home;

CREATE MATERIALIZED VIEW public.games_new_home AS
SELECT
  g.*,
  (
    g.is_indie
    AND g.steam_release_date IS NOT NULL
    AND g.steam_release_date >= (CURRENT_DATE - INTERVAL '6 months')::date
  ) AS is_recent_indie,
  CASE
    WHEN (
      g.is_indie
      AND g.steam_release_date IS NOT NULL
      AND g.steam_release_date >= (CURRENT_DATE - INTERVAL '6 months')::date
    ) THEN 0
    WHEN g.is_indie THEN 1
    ELSE 2
  END AS home_bucket
FROM public.games_new g;

COMMENT ON MATERIALIZED VIEW public.games_new_home
IS 'Materialized home ranking view (refresh to update rolling window).';

-- Index for the exact home page ordering.
CREATE INDEX IF NOT EXISTS games_new_home_rank_idx
ON public.games_new_home (home_bucket, suggestions_count DESC, created_at DESC, appid ASC);

-- Expose to PostgREST roles.
GRANT SELECT ON public.games_new_home TO anon, authenticated;

-- Note: refresh this view when you ingest/update games:
--   REFRESH MATERIALIZED VIEW public.games_new_home;

