-- Simplify games_new_home: convert from materialized view to regular view
-- Since games_new now has generated columns (suggestions_count, steam_release_date, is_indie),
-- we can compute home_bucket on-the-fly without needing materialization or refresh tracking.
--
-- This eliminates:
-- - games_new_home_refresh_tracker table
-- - auto_refresh_games_new_home() function and trigger
-- - refresh_games_new_home() function
-- - Need to manually refresh the materialized view

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_auto_refresh_games_new_home ON public.games_new;

-- Drop the refresh functions
DROP FUNCTION IF EXISTS public.auto_refresh_games_new_home();
DROP FUNCTION IF EXISTS public.refresh_games_new_home();

-- Drop the refresh tracker table
DROP TABLE IF EXISTS public.games_new_home_refresh_tracker CASCADE;

-- Convert materialized view to regular view
DROP MATERIALIZED VIEW IF EXISTS public.games_new_home CASCADE;

CREATE VIEW public.games_new_home AS
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

COMMENT ON VIEW public.games_new_home
IS 'Home-page ordered games view: computes home_bucket on-the-fly using generated columns from games_new.';

-- Grant permissions
GRANT SELECT ON public.games_new_home TO anon, authenticated;
