-- Fix RLS policy for game_suggestions to allow UPSERT operations
-- The existing policy only allows INSERT, but upsert() requires UPDATE as well

-- Allow public update (for server-side suggestion regeneration/updates)
CREATE POLICY "Allow public update to game_suggestions" ON public.game_suggestions
  FOR UPDATE USING (true) WITH CHECK (true);
