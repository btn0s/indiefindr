-- Remove old suggestion system tables and columns
-- These are replaced by the new embedding-based similarity system in game_embeddings

-- Drop the game_suggestions table (replaced by game_embeddings similarity search)
DROP TABLE IF EXISTS public.game_suggestions CASCADE;

-- Drop the generated column that counted suggestions
-- Note: We need to recreate the view first since it depends on games_new columns
DROP VIEW IF EXISTS public.games_new_home;

-- Drop the suggestions_count generated column
ALTER TABLE public.games_new
DROP COLUMN IF EXISTS suggestions_count;

-- Drop the suggested_game_appids JSONB column (no longer used)
ALTER TABLE public.games_new
DROP COLUMN IF EXISTS suggested_game_appids;

-- Recreate the games_new_home view without suggestions_count
-- Now ordering just by recency within buckets (since all games will have embeddings)
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
