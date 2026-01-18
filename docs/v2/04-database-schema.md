# Database Schema

Complete SQL schema for the v2 embedding-based recommendation system.

## Overview

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   games_new     │────▶│  game_embeddings    │     │  game_igdb_data │
│   (existing)    │     │  (new)              │     │  (new)          │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
        │                        │
        │                        ▼
        │               ┌─────────────────────┐
        └──────────────▶│  game_reviews       │
                        │  (new, Phase 5)     │
                        └─────────────────────┘
```

---

## Extensions

```sql
-- Enable vector extension (already enabled in most Supabase instances)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable trigram for fuzzy text search (optional, for tag matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## Core Tables

### game_embeddings

The main table storing multi-facet embeddings for each game.

```sql
CREATE TABLE game_embeddings (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to games
  appid INTEGER NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,

  -- Facet type (enum-like constraint)
  facet TEXT NOT NULL CHECK (facet IN (
    'aesthetic',   -- Visual style
    'atmosphere',  -- Emotional mood
    'mechanics',   -- Gameplay patterns
    'narrative',   -- Theme and story
    'dynamics'     -- Pacing and feel
  )),

  -- The embedding vector (768 dimensions for SigLIP compatibility)
  embedding vector(768) NOT NULL,

  -- Model tracking for reproducibility
  embedding_model TEXT NOT NULL DEFAULT 'siglip2-base-patch16-224',
  embedding_version INTEGER NOT NULL DEFAULT 1,

  -- Source data tracking (for debugging and regeneration)
  source_type TEXT NOT NULL CHECK (source_type IN (
    'image',      -- From screenshots/images
    'text',       -- From text templates
    'multimodal', -- Combined image + text
    'video'       -- From video analysis
  )),
  source_data JSONB,  -- URLs, text snippets, etc.

  -- Optional quality signals
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one embedding per facet per game
  UNIQUE(appid, facet)
);

-- Index for looking up embeddings by game
CREATE INDEX game_embeddings_appid_idx ON game_embeddings(appid);

-- Index for looking up embeddings by facet
CREATE INDEX game_embeddings_facet_idx ON game_embeddings(facet);
```

### HNSW Indexes (Per-Facet)

Filtered HNSW indexes for efficient similarity search within each facet.

```sql
-- AESTHETIC: Visual similarity
CREATE INDEX game_embeddings_aesthetic_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'aesthetic';

-- ATMOSPHERE: Mood similarity
CREATE INDEX game_embeddings_atmosphere_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'atmosphere';

-- MECHANICS: Gameplay similarity
CREATE INDEX game_embeddings_mechanics_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'mechanics';

-- NARRATIVE: Theme similarity
CREATE INDEX game_embeddings_narrative_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'narrative';

-- DYNAMICS: Pacing similarity
CREATE INDEX game_embeddings_dynamics_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'dynamics';
```

**HNSW Parameters:**
- `m = 16`: Connections per node (higher = better recall, more memory)
- `ef_construction = 64`: Build-time search depth (higher = better index, slower build)

---

### game_igdb_data

Enrichment data from IGDB API.

```sql
CREATE TABLE game_igdb_data (
  -- Foreign key to games (also primary key)
  appid INTEGER PRIMARY KEY REFERENCES games_new(appid) ON DELETE CASCADE,

  -- IGDB identifier
  igdb_id INTEGER,

  -- Structured metadata
  themes TEXT[],              -- ['Horror', 'Sci-fi', 'Mystery']
  keywords TEXT[],            -- ['Procedural', 'Permadeath', 'Crafting']
  player_perspectives TEXT[], -- ['Side view', 'First person', 'Bird view']
  game_modes TEXT[],          -- ['Single player', 'Co-operative', 'Battle Royale']
  game_engines TEXT[],        -- ['Unity', 'Unreal Engine', 'Godot']

  -- Extended story content
  storyline TEXT,

  -- Fetch tracking
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for theme-based queries (GIN for array containment)
CREATE INDEX game_igdb_data_themes_idx ON game_igdb_data USING GIN (themes);
CREATE INDEX game_igdb_data_keywords_idx ON game_igdb_data USING GIN (keywords);
```

---

### game_reviews (Phase 5)

Cached Steam reviews for dynamics mining.

```sql
CREATE TABLE game_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to games
  appid INTEGER NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,

  -- Review content
  review_id TEXT NOT NULL,     -- Steam's review ID
  review_text TEXT NOT NULL,

  -- Review metadata
  voted_up BOOLEAN,
  votes_up INTEGER DEFAULT 0,
  playtime_at_review INTEGER,  -- Minutes
  language TEXT DEFAULT 'english',

  -- Extracted dynamics descriptors (computed)
  dynamics_descriptors JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(appid, review_id)
);

-- Index for fetching reviews by game
CREATE INDEX game_reviews_appid_idx ON game_reviews(appid);
```

---

## Functions

### find_similar_games

Find similar games by a single facet.

```sql
CREATE OR REPLACE FUNCTION find_similar_games(
  p_appid INTEGER,
  p_facet TEXT,
  p_limit INTEGER DEFAULT 12,
  p_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  appid INTEGER,
  title TEXT,
  header_image TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  source_embedding vector(768);
BEGIN
  -- Validate facet
  IF p_facet NOT IN ('aesthetic', 'atmosphere', 'mechanics', 'narrative', 'dynamics') THEN
    RAISE EXCEPTION 'Invalid facet: %', p_facet;
  END IF;

  -- Get source game's embedding
  SELECT embedding INTO source_embedding
  FROM game_embeddings
  WHERE appid = p_appid AND facet = p_facet;

  -- Return empty if no embedding found
  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Find similar games
  RETURN QUERY
  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    (1 - (ge.embedding <=> source_embedding))::FLOAT AS similarity
  FROM game_embeddings ge
  JOIN games_new g ON g.appid = ge.appid
  WHERE ge.facet = p_facet
    AND ge.appid != p_appid
    AND (1 - (ge.embedding <=> source_embedding)) >= p_threshold
  ORDER BY ge.embedding <=> source_embedding
  LIMIT p_limit;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION find_similar_games TO authenticated, anon;
```

### find_similar_games_weighted

Find similar games with weighted multi-facet matching.

```sql
CREATE OR REPLACE FUNCTION find_similar_games_weighted(
  p_appid INTEGER,
  p_weights JSONB,  -- {"aesthetic": 0.3, "mechanics": 0.4, "narrative": 0.3}
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  appid INTEGER,
  title TEXT,
  header_image TEXT,
  weighted_similarity FLOAT,
  facet_scores JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Get source game's embeddings for requested facets
  source_embeddings AS (
    SELECT facet, embedding
    FROM game_embeddings
    WHERE appid = p_appid
      AND facet IN (SELECT jsonb_object_keys(p_weights))
  ),

  -- Calculate similarity for each game and facet
  similarities AS (
    SELECT
      ge.appid,
      ge.facet,
      1 - (ge.embedding <=> se.embedding) AS similarity
    FROM game_embeddings ge
    JOIN source_embeddings se ON ge.facet = se.facet
    WHERE ge.appid != p_appid
  ),

  -- Compute weighted average
  weighted AS (
    SELECT
      s.appid,
      -- Weighted average similarity
      SUM(s.similarity * COALESCE((p_weights->>s.facet)::FLOAT, 0)) /
        NULLIF(SUM(COALESCE((p_weights->>s.facet)::FLOAT, 0)), 0) AS weighted_sim,
      -- Individual facet scores for UI display
      jsonb_object_agg(s.facet, ROUND(s.similarity::NUMERIC, 3)) AS scores
    FROM similarities s
    GROUP BY s.appid
  )

  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    w.weighted_sim::FLOAT,
    w.scores
  FROM weighted w
  JOIN games_new g ON g.appid = w.appid
  WHERE w.weighted_sim >= 0.4
  ORDER BY w.weighted_sim DESC
  LIMIT p_limit;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION find_similar_games_weighted TO authenticated, anon;
```

### search_games_by_embedding

Search games using a raw embedding vector (for text-to-game or image-to-game search).

```sql
CREATE OR REPLACE FUNCTION search_games_by_embedding(
  p_query_embedding vector(768),
  p_facet TEXT,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  appid INTEGER,
  title TEXT,
  header_image TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Validate facet
  IF p_facet NOT IN ('aesthetic', 'atmosphere', 'mechanics', 'narrative', 'dynamics') THEN
    RAISE EXCEPTION 'Invalid facet: %', p_facet;
  END IF;

  RETURN QUERY
  SELECT
    g.appid::INTEGER,
    g.title,
    g.header_image,
    (1 - (ge.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM game_embeddings ge
  JOIN games_new g ON g.appid = ge.appid
  WHERE ge.facet = p_facet
  ORDER BY ge.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION search_games_by_embedding TO authenticated, anon;
```

### get_embedding_coverage

Utility function to check embedding coverage.

```sql
CREATE OR REPLACE FUNCTION get_embedding_coverage()
RETURNS TABLE (
  facet TEXT,
  game_count BIGINT,
  total_games BIGINT,
  coverage_pct FLOAT
)
LANGUAGE sql
STABLE
AS $$
  WITH total AS (
    SELECT COUNT(*) as total FROM games_new
  ),
  by_facet AS (
    SELECT facet, COUNT(DISTINCT appid) as count
    FROM game_embeddings
    GROUP BY facet
  )
  SELECT
    f.facet,
    f.count,
    t.total,
    ROUND((f.count::FLOAT / t.total * 100)::NUMERIC, 1)::FLOAT
  FROM by_facet f
  CROSS JOIN total t
  ORDER BY f.facet;
$$;
```

---

## Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE game_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_igdb_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_reviews ENABLE ROW LEVEL SECURITY;

-- Public read access for embeddings
CREATE POLICY "Public read access for embeddings"
  ON game_embeddings FOR SELECT
  USING (true);

-- Service role write access for embeddings
CREATE POLICY "Service role write access for embeddings"
  ON game_embeddings FOR ALL
  USING (auth.role() = 'service_role');

-- Public read access for IGDB data
CREATE POLICY "Public read access for IGDB data"
  ON game_igdb_data FOR SELECT
  USING (true);

-- Service role write access for IGDB data
CREATE POLICY "Service role write access for IGDB data"
  ON game_igdb_data FOR ALL
  USING (auth.role() = 'service_role');

-- Public read access for reviews
CREATE POLICY "Public read access for reviews"
  ON game_reviews FOR SELECT
  USING (true);

-- Service role write access for reviews
CREATE POLICY "Service role write access for reviews"
  ON game_reviews FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Triggers

### Update timestamp trigger

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to game_embeddings
CREATE TRIGGER update_game_embeddings_updated_at
  BEFORE UPDATE ON game_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Migration File

Save as `supabase/migrations/YYYYMMDDHHMMSS_add_game_embeddings.sql`:

```sql
-- Migration: Add game embeddings infrastructure for v2
-- Description: Creates tables and functions for multi-facet embedding-based recommendations

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Create game_embeddings table
CREATE TABLE IF NOT EXISTS game_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appid INTEGER NOT NULL REFERENCES games_new(appid) ON DELETE CASCADE,
  facet TEXT NOT NULL CHECK (facet IN ('aesthetic', 'atmosphere', 'mechanics', 'narrative', 'dynamics')),
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'siglip2-base-patch16-224',
  embedding_version INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL CHECK (source_type IN ('image', 'text', 'multimodal', 'video')),
  source_data JSONB,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(appid, facet)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS game_embeddings_appid_idx ON game_embeddings(appid);
CREATE INDEX IF NOT EXISTS game_embeddings_facet_idx ON game_embeddings(facet);

-- Create HNSW indexes (run after initial data load for efficiency)
-- These will be created by a separate migration after backfill

-- Create game_igdb_data table
CREATE TABLE IF NOT EXISTS game_igdb_data (
  appid INTEGER PRIMARY KEY REFERENCES games_new(appid) ON DELETE CASCADE,
  igdb_id INTEGER,
  themes TEXT[],
  keywords TEXT[],
  player_perspectives TEXT[],
  game_modes TEXT[],
  game_engines TEXT[],
  storyline TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_igdb_data_themes_idx ON game_igdb_data USING GIN (themes);
CREATE INDEX IF NOT EXISTS game_igdb_data_keywords_idx ON game_igdb_data USING GIN (keywords);

-- Enable RLS
ALTER TABLE game_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_igdb_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public read access for embeddings"
  ON game_embeddings FOR SELECT USING (true);

CREATE POLICY "Service role write access for embeddings"
  ON game_embeddings FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for IGDB data"
  ON game_igdb_data FOR SELECT USING (true);

CREATE POLICY "Service role write access for IGDB data"
  ON game_igdb_data FOR ALL USING (auth.role() = 'service_role');

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_game_embeddings_updated_at
  BEFORE UPDATE ON game_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create similarity search functions
-- (Include function definitions from above)
```

---

## TypeScript Types

```typescript
// src/lib/supabase/types-v2.ts

export type FacetType =
  | "aesthetic"
  | "atmosphere"
  | "mechanics"
  | "narrative"
  | "dynamics";

export type SourceType =
  | "image"
  | "text"
  | "multimodal"
  | "video";

export interface GameEmbedding {
  id: string;
  appid: number;
  facet: FacetType;
  embedding: number[];
  embedding_model: string;
  embedding_version: number;
  source_type: SourceType;
  source_data: Record<string, unknown> | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface GameIgdbData {
  appid: number;
  igdb_id: number | null;
  themes: string[] | null;
  keywords: string[] | null;
  player_perspectives: string[] | null;
  game_modes: string[] | null;
  game_engines: string[] | null;
  storyline: string | null;
  fetched_at: string;
}

export interface SimilarGame {
  appid: number;
  title: string;
  header_image: string | null;
  similarity: number;
}

export interface SimilarGameWeighted extends SimilarGame {
  weighted_similarity: number;
  facet_scores: Record<FacetType, number>;
}

export interface FacetWeights {
  aesthetic?: number;
  atmosphere?: number;
  mechanics?: number;
  narrative?: number;
  dynamics?: number;
}
```

---

## Maintenance Queries

### Check embedding coverage

```sql
SELECT * FROM get_embedding_coverage();
```

### Find games without embeddings

```sql
SELECT g.appid, g.title
FROM games_new g
LEFT JOIN game_embeddings ge ON g.appid = ge.appid
WHERE ge.appid IS NULL;
```

### Rebuild HNSW indexes

```sql
-- Drop and recreate for better performance after bulk inserts
DROP INDEX IF EXISTS game_embeddings_aesthetic_hnsw_idx;
CREATE INDEX game_embeddings_aesthetic_hnsw_idx
  ON game_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE facet = 'aesthetic';

-- Repeat for other facets...
```

### Vacuum and analyze

```sql
VACUUM ANALYZE game_embeddings;
```

---

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Vector Guide](https://supabase.com/docs/guides/ai/vector-columns)
- [HNSW Index Tuning](https://github.com/pgvector/pgvector#hnsw)
