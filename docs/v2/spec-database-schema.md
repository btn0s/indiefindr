# Database Schema

## Overview

V2 uses a separate table (`game_embeddings_v2`) to store embeddings, keeping the v1 system completely isolated.

## Table: `game_embeddings_v2`

```sql
CREATE TABLE IF NOT EXISTS game_embeddings_v2 (
  appid BIGINT PRIMARY KEY REFERENCES games_new(appid) ON DELETE CASCADE,
  
  -- Embedding facets
  tags_embedding vector(1536),
  vibe_embedding vector(1536),
  mechanics_embedding vector(1536),
  visual_embedding vector(1536),       -- Future use
  
  -- Metadata
  embedding_model TEXT DEFAULT 'openai/text-embedding-3-small',
  tags_source JSONB,                   -- Snapshot of tags used
  
  -- Game profile (pre-computed classification)
  game_type TEXT,                      -- 'aesthetic', 'gameplay', 'narrative', 'balanced'
  game_type_confidence FLOAT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Indexes

Using HNSW (faster than ivfflat for <1M rows):

```sql
-- Tags embedding (most queries)
CREATE INDEX idx_v2_tags ON game_embeddings_v2 
  USING hnsw (tags_embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);

-- Vibe embedding
CREATE INDEX idx_v2_vibe ON game_embeddings_v2 
  USING hnsw (vibe_embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);

-- Mechanics embedding
CREATE INDEX idx_v2_mechanics ON game_embeddings_v2 
  USING hnsw (mechanics_embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);

-- Visual embedding (future)
CREATE INDEX idx_v2_visual ON game_embeddings_v2 
  USING hnsw (visual_embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);

-- Game type for filtering
CREATE INDEX idx_v2_game_type ON game_embeddings_v2 (game_type);
```

### HNSW Parameters

| Parameter | Value | Reason |
|-----------|-------|--------|
| `m` | 16 | Connections per node (default, good balance) |
| `ef_construction` | 64 | Build quality (higher = better recall, slower build) |

Query-time `ef_search` defaults to 40 (can tune for latency/recall tradeoff).

## RRF Search Function

```sql
CREATE OR REPLACE FUNCTION find_similar_games_v2(
  source_appid BIGINT,
  match_limit INT DEFAULT 10,
  tags_weight FLOAT DEFAULT 0.30,
  vibe_weight FLOAT DEFAULT 0.30,
  mechanics_weight FLOAT DEFAULT 0.30,
  visual_weight FLOAT DEFAULT 0.10
)
RETURNS TABLE (
  appid BIGINT,
  title TEXT,
  header_image TEXT,
  rrf_score FLOAT,
  tags_rank INT,
  vibe_rank INT,
  mechanics_rank INT,
  visual_rank INT,
  match_facets TEXT[]
) AS $$
DECLARE
  src RECORD;
BEGIN
  -- Get source embeddings
  SELECT * INTO src FROM game_embeddings_v2 e WHERE e.appid = source_appid;
  
  IF src IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH 
  tags_matches AS (
    SELECT e.appid, ROW_NUMBER() OVER (ORDER BY e.tags_embedding <=> src.tags_embedding) as rank
    FROM game_embeddings_v2 e
    WHERE e.appid != source_appid AND e.tags_embedding IS NOT NULL
    ORDER BY e.tags_embedding <=> src.tags_embedding
    LIMIT 50
  ),
  vibe_matches AS (
    SELECT e.appid, ROW_NUMBER() OVER (ORDER BY e.vibe_embedding <=> src.vibe_embedding) as rank
    FROM game_embeddings_v2 e
    WHERE e.appid != source_appid AND e.vibe_embedding IS NOT NULL
    ORDER BY e.vibe_embedding <=> src.vibe_embedding
    LIMIT 50
  ),
  mechanics_matches AS (
    SELECT e.appid, ROW_NUMBER() OVER (ORDER BY e.mechanics_embedding <=> src.mechanics_embedding) as rank
    FROM game_embeddings_v2 e
    WHERE e.appid != source_appid AND e.mechanics_embedding IS NOT NULL
    ORDER BY e.mechanics_embedding <=> src.mechanics_embedding
    LIMIT 50
  ),
  visual_matches AS (
    SELECT e.appid, ROW_NUMBER() OVER (ORDER BY e.visual_embedding <=> src.visual_embedding) as rank
    FROM game_embeddings_v2 e
    WHERE e.appid != source_appid AND e.visual_embedding IS NOT NULL
    ORDER BY e.visual_embedding <=> src.visual_embedding
    LIMIT 50
  ),
  combined AS (
    SELECT 
      COALESCE(t.appid, v.appid, m.appid, vs.appid) as appid,
      t.rank as tags_rank,
      v.rank as vibe_rank,
      m.rank as mechanics_rank,
      vs.rank as visual_rank,
      -- RRF formula: sum of 1/(k + rank) with k=60
      (tags_weight / (60 + COALESCE(t.rank, 1000))) +
      (vibe_weight / (60 + COALESCE(v.rank, 1000))) +
      (mechanics_weight / (60 + COALESCE(m.rank, 1000))) +
      (visual_weight / (60 + COALESCE(vs.rank, 1000))) as rrf_score,
      -- Track which facets matched in top 20
      ARRAY_REMOVE(ARRAY[
        CASE WHEN t.rank <= 20 THEN 'tags' END,
        CASE WHEN v.rank <= 20 THEN 'vibe' END,
        CASE WHEN m.rank <= 20 THEN 'mechanics' END,
        CASE WHEN vs.rank <= 20 THEN 'visual' END
      ], NULL) as match_facets
    FROM tags_matches t
    FULL OUTER JOIN vibe_matches v ON t.appid = v.appid
    FULL OUTER JOIN mechanics_matches m ON COALESCE(t.appid, v.appid) = m.appid
    FULL OUTER JOIN visual_matches vs ON COALESCE(t.appid, v.appid, m.appid) = vs.appid
  )
  SELECT 
    c.appid,
    g.title,
    g.header_image,
    c.rrf_score,
    c.tags_rank::INT,
    c.vibe_rank::INT,
    c.mechanics_rank::INT,
    c.visual_rank::INT,
    c.match_facets
  FROM combined c
  JOIN games_new g ON g.appid = c.appid
  ORDER BY c.rrf_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;
```

## Migration

```sql
-- supabase/migrations/2026XXXX_add_v2_embeddings.sql

-- Ensure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create v2 embeddings table
CREATE TABLE IF NOT EXISTS game_embeddings_v2 (
  appid BIGINT PRIMARY KEY REFERENCES games_new(appid) ON DELETE CASCADE,
  tags_embedding vector(1536),
  vibe_embedding vector(1536),
  mechanics_embedding vector(1536),
  visual_embedding vector(1536),
  embedding_model TEXT DEFAULT 'openai/text-embedding-3-small',
  tags_source JSONB,
  game_type TEXT,
  game_type_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW indexes
CREATE INDEX idx_v2_tags ON game_embeddings_v2 
  USING hnsw (tags_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_v2_vibe ON game_embeddings_v2 
  USING hnsw (vibe_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_v2_mechanics ON game_embeddings_v2 
  USING hnsw (mechanics_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_v2_visual ON game_embeddings_v2 
  USING hnsw (visual_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_v2_game_type ON game_embeddings_v2 (game_type);

-- RLS
ALTER TABLE game_embeddings_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON game_embeddings_v2 FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON game_embeddings_v2 FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_v2_embeddings_updated_at
  BEFORE UPDATE ON game_embeddings_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Querying Embeddings

```typescript
// Get embeddings for a game
const { data } = await supabase
  .from('game_embeddings_v2')
  .select('*')
  .eq('appid', appid)
  .single();

// Find similar games using RPC
const { data: similar } = await supabase.rpc('find_similar_games_v2', {
  source_appid: appid,
  match_limit: 10,
  tags_weight: 0.30,
  vibe_weight: 0.30,
  mechanics_weight: 0.30,
  visual_weight: 0.10,
});
```
