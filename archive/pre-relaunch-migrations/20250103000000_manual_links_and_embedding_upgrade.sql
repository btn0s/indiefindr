-- Resize embedding vectors to 1536 dims (ivfflat limit) and add manual links table

DROP INDEX IF EXISTS idx_games_aesthetic_embedding;
DROP INDEX IF EXISTS idx_games_gameplay_embedding;
DROP INDEX IF EXISTS idx_games_narrative_embedding;

UPDATE games SET aesthetic_embedding = NULL, gameplay_embedding = NULL, narrative_embedding = NULL;

ALTER TABLE games ALTER COLUMN aesthetic_embedding TYPE vector(1536);
ALTER TABLE games ALTER COLUMN gameplay_embedding TYPE vector(1536);
ALTER TABLE games ALTER COLUMN narrative_embedding TYPE vector(1536);

CREATE INDEX IF NOT EXISTS idx_games_aesthetic_embedding
  ON games USING ivfflat (aesthetic_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_games_gameplay_embedding
  ON games USING ivfflat (gameplay_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_games_narrative_embedding
  ON games USING ivfflat (narrative_embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS manual_similarities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_appid BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  target_appid BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  facets TEXT[] NOT NULL DEFAULT ARRAY['overall'],
  note TEXT,
  created_by TEXT DEFAULT 'anon',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT manual_similarities_no_self CHECK (source_appid <> target_appid)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_manual_similarity_pair
  ON manual_similarities (
    LEAST(source_appid, target_appid),
    GREATEST(source_appid, target_appid)
  );

CREATE INDEX IF NOT EXISTS idx_manual_facets ON manual_similarities USING GIN (facets);

DROP TRIGGER IF EXISTS update_manual_similarities_updated_at ON manual_similarities;
CREATE TRIGGER update_manual_similarities_updated_at
  BEFORE UPDATE ON manual_similarities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE manual_similarities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to manual_similarities" ON manual_similarities;
CREATE POLICY "Allow public read access to manual_similarities" ON manual_similarities
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert/update to manual_similarities" ON manual_similarities;
CREATE POLICY "Allow public insert/update to manual_similarities" ON manual_similarities
  FOR ALL USING (true);
