-- Fix collection_games RLS policy to work better with .in() queries
-- The EXISTS subquery might cause issues with PostgREST when using .in()
-- We'll drop and recreate the policy to ensure it's correct

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow public read access to collection games" ON public.collection_games;

-- Recreate with the same logic but ensure it works with .in() queries
CREATE POLICY "Allow public read access to collection games" ON public.collection_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_games.collection_id
      AND collections.published = true
    )
  );

-- Ensure there's an index to help with the EXISTS check performance
CREATE INDEX IF NOT EXISTS idx_collections_id_published 
ON collections(id) 
WHERE published = true;
