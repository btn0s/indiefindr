-- Clean up functions that reference the dropped games table
-- These functions were created before games table was dropped and weren't automatically removed

DROP FUNCTION IF EXISTS public.get_related_games(BIGINT, TEXT, INTEGER, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.match_games_by_facet(bigint, text, integer, double precision);
