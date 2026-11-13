-- Drop unused tables: suggestions and game_vibes
-- This migration is idempotent (uses IF EXISTS and CASCADE)
--
-- Note: 
-- - suggestions table is empty and unused (replaced by suggested_game_appids JSONB in games_new)
-- - game_vibes table is unused (no code references, replaced by other suggestion mechanisms)

-- Drop function that references game_vibes
DROP FUNCTION IF EXISTS public.find_similar_vibes(INTEGER, INTEGER, DOUBLE PRECISION);

-- Drop unused tables (CASCADE to remove dependent objects like indexes, triggers, policies)
DROP TABLE IF EXISTS public.game_vibes CASCADE;
DROP TABLE IF EXISTS public.suggestions CASCADE;
