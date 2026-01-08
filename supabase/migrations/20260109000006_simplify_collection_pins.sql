-- Simplify collection pinning: move home page pins to collections table
-- Since game-specific pinning isn't used, we can drop collection_pins entirely
-- and just add pinned_to_home + home_position to collections table

-- Add pinning fields to collections table
ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS pinned_to_home BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS home_position INTEGER NOT NULL DEFAULT 0;

-- Migrate existing home pins to collections table
UPDATE public.collections c
SET 
  pinned_to_home = true,
  home_position = COALESCE(
    (SELECT cp.position FROM collection_pins cp 
     WHERE cp.collection_id = c.id AND cp.context = 'home' 
     LIMIT 1),
    0
  )
WHERE EXISTS (
  SELECT 1 FROM collection_pins cp 
  WHERE cp.collection_id = c.id AND cp.context = 'home'
);

-- Drop the collection_pins table (no longer needed)
DROP TABLE IF EXISTS public.collection_pins CASCADE;

-- Create index for home page queries
CREATE INDEX IF NOT EXISTS idx_collections_pinned_home 
ON public.collections(pinned_to_home, home_position) 
WHERE pinned_to_home = true;

COMMENT ON COLUMN public.collections.pinned_to_home IS 'Whether this collection should be displayed on the home page';
COMMENT ON COLUMN public.collections.home_position IS 'Ordering position when displayed on home page (lower = earlier)';
