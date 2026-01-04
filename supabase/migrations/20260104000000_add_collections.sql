-- Collections (custom lists) + items
-- Used for pinned rows on home and collection detail pages.

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  appid BIGINT NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, appid)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collections_pinned_rank
  ON collections(pinned, pinned_rank, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id
  ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_appid
  ON collection_items(appid);

-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_collections_updated_at'
  ) THEN
    CREATE TRIGGER update_collections_updated_at
      BEFORE UPDATE ON collections
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Public read-only (mutations should use service role / admin routes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collections'
      AND policyname = 'Allow public read access to collections'
  ) THEN
    CREATE POLICY "Allow public read access to collections" ON collections
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_items'
      AND policyname = 'Allow public read access to collection_items'
  ) THEN
    CREATE POLICY "Allow public read access to collection_items" ON collection_items
      FOR SELECT USING (true);
  END IF;
END $$;

