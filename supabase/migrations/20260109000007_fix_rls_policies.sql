-- Fix RLS security issues
-- Enable RLS on tables that need it and add appropriate policies
-- Fix function search_path security issues

-- ============================================================================
-- Enable RLS on rate_limits table
-- ============================================================================
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for checking rate limits)
CREATE POLICY "Allow public read access to rate_limits" ON public.rate_limits
  FOR SELECT USING (true);

-- Allow public insert/update (for server-side rate limiting)
CREATE POLICY "Allow public insert/update to rate_limits" ON public.rate_limits
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Enable RLS on game_suggestions table
-- ============================================================================
ALTER TABLE public.game_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for displaying suggestions)
CREATE POLICY "Allow public read access to game_suggestions" ON public.game_suggestions
  FOR SELECT USING (true);

-- Allow public insert (for server-side suggestion generation)
CREATE POLICY "Allow public insert to game_suggestions" ON public.game_suggestions
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- Fix function search_path security issues
-- ============================================================================

-- Fix steam_try_parse_release_date
CREATE OR REPLACE FUNCTION public.steam_try_parse_release_date(date_text TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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

-- Fix steam_is_likely_indie
CREATE OR REPLACE FUNCTION public.steam_is_likely_indie(raw JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix search_games
CREATE OR REPLACE FUNCTION public.search_games(
  search_query text,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  appid bigint,
  title text,
  header_image text,
  rank real
)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- ============================================================================
-- Fix games_new_home view grants (views should only have SELECT)
-- ============================================================================
REVOKE ALL ON public.games_new_home FROM anon, authenticated, service_role;
GRANT SELECT ON public.games_new_home TO anon, authenticated;
