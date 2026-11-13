-- Create helper functions + a view for reliable home-page ordering.
-- This avoids fetching a large batch in the app and sorting client-side.

-- ============================================================================
-- Steam date parsing (best-effort)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.steam_try_parse_release_date(date_text TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT;
  d DATE;
BEGIN
  IF date_text IS NULL OR btrim(date_text) = '' THEN
    RETURN NULL;
  END IF;

  IF lower(date_text) LIKE '%coming soon%' THEN
    RETURN NULL;
  END IF;

  -- Normalize commas and repeated whitespace.
  cleaned := regexp_replace(replace(date_text, ',', ''), '\s+', ' ', 'g');
  cleaned := btrim(cleaned);

  -- Common Steam formats:
  -- - "Nov 25, 2025"  -> "Nov 25 2025"
  -- - "25 Nov, 2025"  -> "25 Nov 2025"
  BEGIN
    d := to_date(cleaned, 'Mon DD YYYY');
    RETURN d;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    d := to_date(cleaned, 'DD Mon YYYY');
    RETURN d;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Sometimes Steam returns month/year only (rare). Example: "Nov 2025"
  BEGIN
    d := to_date(cleaned, 'Mon YYYY');
    RETURN d;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.steam_try_parse_release_date(TEXT)
IS 'Best-effort parser for Steam raw.release_date.date strings.';

-- ============================================================================
-- Indie heuristic in SQL (mirrors app logic)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.steam_is_likely_indie(raw JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  major TEXT[] := ARRAY[
    'electronic arts',
    'ea',
    'ubisoft',
    'activision',
    'activision blizzard',
    'take-two interactive',
    'rockstar games',
    '2k games',
    'warner bros',
    'warner bros. interactive entertainment',
    'warner bros interactive',
    'sony interactive entertainment',
    'playstation',
    'microsoft',
    'xbox game studios',
    'nintendo',
    'bethesda',
    'zenimax',
    'square enix',
    'capcom',
    'bandai namco',
    'bandai namco entertainment',
    'sega',
    'konami',
    'namco',
    'thq',
    'thq nordic',
    'focus home interactive',
    'paradox interactive',
    'wargaming',
    'riot games',
    'blizzard entertainment',
    'valve',
    'epic games'
  ];
  has_major BOOLEAN := FALSE;
  developer_single TEXT;
BEGIN
  -- If we don't have raw data, assume indie (same as app).
  IF raw IS NULL OR jsonb_typeof(raw) <> 'object' THEN
    RETURN TRUE;
  END IF;

  -- Publishers
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(raw->'publishers', '[]'::jsonb)) AS pub(name)
    WHERE lower(btrim(pub.name)) = ANY(major)
  )
  INTO has_major;

  IF has_major THEN
    RETURN FALSE;
  END IF;

  -- Developers
  IF jsonb_typeof(raw->'developers') = 'array' THEN
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(raw->'developers') AS dev(name)
      WHERE lower(btrim(dev.name)) = ANY(major)
    )
    INTO has_major;
  ELSE
    developer_single := nullif(lower(btrim(raw->>'developer')), '');
    has_major := developer_single = ANY(major);
  END IF;

  IF has_major THEN
    RETURN FALSE;
  END IF;

  -- No major publisher/developer found => assume indie (matches JS fallback).
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.steam_is_likely_indie(JSONB)
IS 'Heuristic for indie detection based on Steam raw JSON (publisher/developer).';

-- ============================================================================
-- Home ranking view
-- ============================================================================

CREATE OR REPLACE VIEW public.games_new_home AS
WITH base AS (
  SELECT
    g.*,
    CASE
      WHEN jsonb_typeof(g.suggested_game_appids) = 'array' THEN jsonb_array_length(g.suggested_game_appids)
      ELSE 0
    END AS suggestions_count,
    public.steam_try_parse_release_date(g.raw->'release_date'->>'date') AS steam_release_date,
    public.steam_is_likely_indie(g.raw) AS is_indie
  FROM public.games_new g
)
SELECT
  base.*,
  (
    base.is_indie
    AND base.steam_release_date IS NOT NULL
    AND base.steam_release_date >= (CURRENT_DATE - INTERVAL '6 months')::date
  ) AS is_recent_indie,
  CASE
    WHEN (
      base.is_indie
      AND base.steam_release_date IS NOT NULL
      AND base.steam_release_date >= (CURRENT_DATE - INTERVAL '6 months')::date
    ) THEN 0
    WHEN base.is_indie THEN 1
    ELSE 2
  END AS home_bucket
FROM base;

COMMENT ON VIEW public.games_new_home
IS 'Home-page ordered games view: provides computed ranking fields for reliable pagination.';

-- Expose to PostgREST roles
GRANT SELECT ON public.games_new_home TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.steam_try_parse_release_date(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.steam_is_likely_indie(JSONB) TO anon, authenticated;

