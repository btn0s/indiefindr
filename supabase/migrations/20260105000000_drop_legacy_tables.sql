-- Drop legacy tables that are no longer used by the application
-- The games table was replaced by games_new
-- The ingest_jobs table was never used by the Next.js app (only by a script)

-- Drop ingest_jobs table (CASCADE to remove dependent objects like policies, indexes, triggers)
DROP TABLE IF EXISTS public.ingest_jobs CASCADE;

-- Drop legacy games table (CASCADE to remove dependent objects)
DROP TABLE IF EXISTS public.games CASCADE;
