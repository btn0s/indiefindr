-- Drop legacy tables that are no longer used by the application
-- The games table was replaced by games_new
-- The ingest_jobs table was never used by the Next.js app (only by a script)

-- Drop functions that reference the legacy games table
DROP FUNCTION IF EXISTS public.get_related_games(BIGINT, TEXT, INTEGER, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.match_games_by_facet(BIGINT, TEXT, DOUBLE PRECISION, INTEGER);

-- Drop manual_similarities table if it exists (it references games table)
DROP TABLE IF EXISTS public.manual_similarities CASCADE;

-- Drop ingest_jobs table (CASCADE to remove dependent objects like policies, indexes, triggers)
DROP TABLE IF EXISTS public.ingest_jobs CASCADE;

-- Drop legacy games table (CASCADE to remove dependent objects)
DROP TABLE IF EXISTS public.games CASCADE;
