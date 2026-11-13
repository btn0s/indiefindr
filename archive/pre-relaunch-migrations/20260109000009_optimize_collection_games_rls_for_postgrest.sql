-- Optimize collection_games RLS policy for PostgREST .in() queries
-- The EXISTS subquery can cause issues with PostgREST when combined with .in()
-- We'll use a JOIN-based approach that PostgREST handles better

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow public read access to collection games" ON public.collection_games;

-- Create a new policy that uses a subquery with IN instead of EXISTS
-- This works better with PostgREST's query planner when using .in()
CREATE POLICY "Allow public read access to collection games" ON public.collection_games
  FOR SELECT USING (
    collection_id IN (
      SELECT id FROM collections WHERE published = true
    )
  );

-- Ensure indexes exist for optimal performance
CREATE INDEX IF NOT EXISTS idx_collections_id_published 
ON collections(id) 
WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_collection_games_collection_id 
ON collection_games(collection_id);
