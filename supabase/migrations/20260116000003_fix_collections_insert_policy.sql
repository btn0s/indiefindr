-- Fix collections INSERT policy to allow trigger function to create default collections
-- The trigger function runs as SECURITY DEFINER (postgres), but auth.uid() returns NULL in that context
-- So we need to allow inserts when current_user is postgres (trigger context)

DROP POLICY IF EXISTS "Allow users to create their collections" ON public.collections;

CREATE POLICY "Allow users to create their collections" ON public.collections
  FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR current_user = 'postgres');
