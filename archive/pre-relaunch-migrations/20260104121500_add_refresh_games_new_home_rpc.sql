-- Allow the server (service_role) to refresh the home materialized view.
-- This keeps the homepage ordering up to date after ingests/suggestion updates.

CREATE OR REPLACE FUNCTION public.refresh_games_new_home()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.games_new_home;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_games_new_home() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_games_new_home() TO service_role;

