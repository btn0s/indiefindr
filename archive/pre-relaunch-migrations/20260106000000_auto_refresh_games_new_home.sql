-- Automatically refresh games_new_home materialized view when games_new is updated
-- This replaces the need to call refreshHomeView() from the application

-- Create a small table to track last refresh time (for throttling)
CREATE TABLE IF NOT EXISTS public.games_new_home_refresh_tracker (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_refresh_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row
INSERT INTO public.games_new_home_refresh_tracker (id, last_refresh_at)
VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create a function that refreshes the materialized view with throttling
-- (only refreshes if at least 5 seconds have passed since last refresh)
CREATE OR REPLACE FUNCTION public.auto_refresh_games_new_home()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_refresh TIMESTAMPTZ;
  throttle_seconds INTEGER := 5;
BEGIN
  -- Check when we last refreshed
  SELECT last_refresh_at INTO last_refresh
  FROM public.games_new_home_refresh_tracker
  WHERE id = 1;

  -- If no record exists or enough time has passed, refresh
  IF last_refresh IS NULL OR (NOW() - last_refresh) >= (throttle_seconds || ' seconds')::INTERVAL THEN
    -- Refresh the materialized view (without CONCURRENTLY to avoid index requirements in trigger)
    REFRESH MATERIALIZED VIEW public.games_new_home;
    
    -- Update the refresh tracker
    UPDATE public.games_new_home_refresh_tracker
    SET last_refresh_at = NOW()
    WHERE id = 1;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on games_new table
DROP TRIGGER IF EXISTS trigger_auto_refresh_games_new_home ON public.games_new;

CREATE TRIGGER trigger_auto_refresh_games_new_home
  AFTER INSERT OR UPDATE ON public.games_new
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_refresh_games_new_home();

COMMENT ON FUNCTION public.auto_refresh_games_new_home()
IS 'Automatically refreshes games_new_home materialized view when games_new is updated, with 5 second throttling';

COMMENT ON TABLE public.games_new_home_refresh_tracker
IS 'Tracks last refresh time for games_new_home materialized view to enable throttling';
