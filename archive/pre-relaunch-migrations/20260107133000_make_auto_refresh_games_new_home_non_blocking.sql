-- Make the auto-refresh trigger non-blocking for writes.
-- In production, REFRESH MATERIALIZED VIEW can be slow or contend on locks.
-- If this happens inside an AFTER INSERT/UPDATE trigger, it can abort ingests
-- with "canceling statement due to statement timeout".

CREATE OR REPLACE FUNCTION public.auto_refresh_games_new_home()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_refresh TIMESTAMPTZ;
  -- Refreshing per-write is expensive; keep the home view "eventually consistent".
  throttle_seconds INTEGER := 30;
BEGIN
  SELECT last_refresh_at INTO last_refresh
  FROM public.games_new_home_refresh_tracker
  WHERE id = 1;

  IF last_refresh IS NULL OR (NOW() - last_refresh) >= (throttle_seconds || ' seconds')::INTERVAL THEN
    BEGIN
      -- Avoid blocking writes on view refresh locks.
      PERFORM set_config('lock_timeout', '2000', true);
      -- Give refresh a bit more breathing room than the default statement_timeout.
      PERFORM set_config('statement_timeout', '60000', true);

      REFRESH MATERIALIZED VIEW public.games_new_home;

      UPDATE public.games_new_home_refresh_tracker
      SET last_refresh_at = NOW()
      WHERE id = 1;
    EXCEPTION
      WHEN query_canceled THEN
        -- Usually statement_timeout; skip refresh rather than failing the write.
        NULL;
      WHEN lock_not_available THEN
        -- Couldn't acquire lock quickly; skip refresh.
        NULL;
      WHEN OTHERS THEN
        -- Fail-open: do not break inserts/updates if refresh fails for any reason.
        NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_refresh_games_new_home()
IS 'Auto-refreshes games_new_home MV with throttling; fail-open so writes never fail if refresh is slow/locked.';

