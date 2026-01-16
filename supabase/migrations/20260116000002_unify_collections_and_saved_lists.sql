-- Migration: Unify saved_lists into collections
-- 
-- This migration extends the collections table to support both curated collections
-- and user-owned collections (including the default "Saved" collection).
-- It migrates existing saved_lists data into collections and updates RLS policies.

-- Step 1: Extend collections table with user ownership fields
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Make slug nullable and adjust uniqueness constraint
-- First, drop the existing unique constraint/index on slug
DO $$
BEGIN
  -- Drop unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'collections_slug_key' 
    AND conrelid = 'public.collections'::regclass
  ) THEN
    ALTER TABLE public.collections DROP CONSTRAINT collections_slug_key;
  END IF;
  
  -- Drop unique index if it exists (might be created as index instead of constraint)
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'collections_slug_key' 
    AND tablename = 'collections'
  ) THEN
    DROP INDEX IF EXISTS public.collections_slug_key;
  END IF;
END $$;

-- Make slug nullable
ALTER TABLE public.collections ALTER COLUMN slug DROP NOT NULL;

-- Create partial unique index for non-null slugs only
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_slug_unique 
ON public.collections(slug) 
WHERE slug IS NOT NULL;

-- Step 3: Add indexes for user-owned collections
CREATE INDEX IF NOT EXISTS idx_collections_owner_id ON public.collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_owner_default 
ON public.collections(owner_id, is_default) 
WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_collections_public 
ON public.collections(is_public) 
WHERE is_public = true AND owner_id IS NOT NULL;

-- Unique constraint: one default collection per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_one_default_per_user 
ON public.collections(owner_id) 
WHERE is_default = true AND owner_id IS NOT NULL;

-- Step 4: Migrate saved_lists to collections (if saved_lists exists)
DO $$
DECLARE
  saved_list_record RECORD;
  new_collection_id UUID;
BEGIN
  -- Only proceed if saved_lists table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_lists'
  ) THEN
    -- Migrate each saved_list to a collection
    FOR saved_list_record IN 
      SELECT id, owner_id, title, is_default, is_public, created_at, updated_at
      FROM public.saved_lists
    LOOP
      INSERT INTO public.collections (
        id, owner_id, title, is_default, is_public, 
        slug, published, pinned_to_home, home_position,
        created_at, updated_at
      )
      VALUES (
        saved_list_record.id, -- Preserve the ID for easier migration
        saved_list_record.owner_id,
        saved_list_record.title,
        saved_list_record.is_default,
        saved_list_record.is_public,
        NULL, -- slug is null for user collections
        false, -- published is false for user collections
        false, -- pinned_to_home is false for user collections
        0, -- home_position is 0 for user collections
        saved_list_record.created_at,
        saved_list_record.updated_at
      )
      ON CONFLICT (id) DO NOTHING; -- Skip if already exists
    END LOOP;
  END IF;
END $$;

-- Step 5: Migrate saved_list_games to collection_games (if saved_list_games exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_list_games'
  ) THEN
    INSERT INTO public.collection_games (collection_id, appid, position, created_at)
    SELECT list_id, appid, 0, created_at
    FROM public.saved_list_games
    ON CONFLICT (collection_id, appid) DO NOTHING; -- Skip duplicates
  END IF;
END $$;

-- Step 6: Update RLS policies for collections
-- Drop existing SELECT-only policies
DROP POLICY IF EXISTS "Allow public read access to published collections" ON public.collections;

-- New SELECT policy: allow if curated & published, or user owns it, or public user collection
CREATE POLICY "Allow read access to collections" ON public.collections
  FOR SELECT USING (
    -- Curated & published
    (owner_id IS NULL AND published = true)
    OR
    -- Owner access
    (owner_id = auth.uid())
    OR
    -- Public user collection
    (owner_id IS NOT NULL AND is_public = true)
  );

-- INSERT policy: allow only user-owned rows
CREATE POLICY "Allow users to create their collections" ON public.collections
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- UPDATE policy: allow only user-owned rows
CREATE POLICY "Allow users to update their collections" ON public.collections
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE policy: allow only user-owned rows
CREATE POLICY "Allow users to delete their collections" ON public.collections
  FOR DELETE
  USING (owner_id = auth.uid());

-- Step 7: Update RLS policies for collection_games
-- Drop existing SELECT-only policy
DROP POLICY IF EXISTS "Allow public read access to collection games" ON public.collection_games;

-- New SELECT policy: allow if parent collection is visible
CREATE POLICY "Allow read access to collection games" ON public.collection_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_games.collection_id
      AND (
        -- Curated & published
        (collections.owner_id IS NULL AND collections.published = true)
        OR
        -- Owner access
        (collections.owner_id = auth.uid())
        OR
        -- Public user collection
        (collections.owner_id IS NOT NULL AND collections.is_public = true)
      )
    )
  );

-- INSERT policy: allow only if parent collection is owned by user
CREATE POLICY "Allow users to add games to their collections" ON public.collection_games
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_games.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

-- UPDATE policy: allow only if parent collection is owned by user
CREATE POLICY "Allow users to update games in their collections" ON public.collection_games
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_games.collection_id
      AND collections.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_games.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

-- DELETE policy: allow only if parent collection is owned by user
CREATE POLICY "Allow users to remove games from their collections" ON public.collection_games
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_games.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

-- Step 8: Drop old saved_lists schema (if it exists)
DO $$
BEGIN
  -- Drop trigger first
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created_create_default_saved_list'
  ) THEN
    DROP TRIGGER IF EXISTS on_auth_user_created_create_default_saved_list ON auth.users;
  END IF;
  
  -- Drop function
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_default_saved_list_for_user'
  ) THEN
    DROP FUNCTION IF EXISTS public.create_default_saved_list_for_user();
  END IF;
  
  -- Drop tables (CASCADE will handle foreign keys)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_list_games'
  ) THEN
    DROP TABLE IF EXISTS public.saved_list_games CASCADE;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_lists'
  ) THEN
    DROP TABLE IF EXISTS public.saved_lists CASCADE;
  END IF;
END $$;

-- Step 9: Create new trigger function for default collections (replaces old saved_lists trigger)
CREATE OR REPLACE FUNCTION create_default_collection_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.collections (owner_id, title, is_default, is_public, published, pinned_to_home, home_position)
  VALUES (NEW.id, 'Saved', true, true, false, false, 0);
  RETURN NEW;
END;
$$;

-- Create trigger to create default collection when a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_create_default_collection ON auth.users;
CREATE TRIGGER on_auth_user_created_create_default_collection
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_collection_for_user();
