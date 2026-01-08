-- Drop legacy tables and functions that are no longer used
-- This migration is idempotent (uses IF EXISTS and CASCADE)
-- 
-- Note: Dropping public.games with CASCADE will also drop:
--   - public.manual_similarities (has foreign keys to games.id)
--   - Any indexes, triggers, policies, etc. on these tables

-- Drop legacy functions that reference the old games table
DROP FUNCTION IF EXISTS public.get_related_games(BIGINT, TEXT, INTEGER, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.match_games_by_facet(BIGINT, TEXT, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS public.match_games_by_facet(bigint, text, integer, double precision);

-- Drop ingest_jobs table (CASCADE to remove dependent objects like policies, indexes, triggers)
DROP TABLE IF EXISTS public.ingest_jobs CASCADE;

-- Drop legacy games table (CASCADE will also drop manual_similarities and other dependents)
DROP TABLE IF EXISTS public.games CASCADE;

-- Explicitly drop manual_similarities if it still exists (orphaned after games was dropped)
DROP TABLE IF EXISTS public.manual_similarities CASCADE;
