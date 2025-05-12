# Backend Design (MVP) - IndieFindr

> **Goal:** Define the core backend components for v0 (MVP) to deliver a **minimal lovable product**. This includes: Steam data ingestion, **generation of semantic game embeddings**, user authentication, personal game libraries, and a dynamic granular feed featuring **semantically relevant new game recommendations** and key content updates (trailers/tweets). This version prioritizes AI-driven discovery from day one, deferring natural language search and other advanced AI features.

---

## 1. Technology Stack (v0)

*   Runtime: Node.js
*   API Framework: Express.js (Deployed as Vercel Serverless Functions)
*   Database (Primary Data): PostgreSQL (Hosted on Supabase)
*   **Database (Vector Embeddings): Pinecone (or similar vector DB)**
*   Authentication: Supabase Auth
*   Crawlers/Monitors: Node.js scripts
*   Deployment: Vercel, Supabase, Pinecone

---

## 2. Core Components

1.  **API Service (`CoreAPI`)**
    *   Built with Express.js, running as serverless functions on Vercel.
    *   Handles all incoming requests from the Next.js frontend.
    *   Interacts with Supabase for database operations and authentication checks.

2.  **Database (PostgreSQL on Supabase)**
    *   Stores all game data (from various external sources like Steam, itch.io) in a primary table (e.g., `external_source`), with an enrichment status field indicating the level of processing (e.g., `pending`, `processing`, `enriched`).
    *   A separate table (e.g., `games_core` or `featured_games`) can be used for manually curated/featured titles, which would also have corresponding entries in the primary game data table.
    *   Stores user data (via Supabase Auth) and user library associations.

3.  **Crawlers (Standalone Scripts)**
    *   Separate Node.js scripts responsible for fetching data from external platforms (Steam, itch.io).
    *   Designed to be run independently (manually or scheduled).
    *   Focus on extracting essential game information initially. **Must respect platform Terms of Service.**

---

## 3. Database Schema (MVP - Simplified)

```sql
-- Users table (Managed primarily by Supabase Auth)
-- public.users inherits from auth.users
-- Add custom columns if needed, e.g., username

-- External Sources (Primary game data table)
CREATE TABLE external_source (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT NOT NULL, -- 'steam', 'itch'
    external_id TEXT NOT NULL, -- Game ID on the external platform
    title TEXT,
    developer TEXT,
    raw_data JSONB, -- Store raw response for future processing
    enrichment_status TEXT DEFAULT 'pending' NOT NULL, -- e.g., pending, basic_info_extracted, content_processing, content_enriched, failed
    is_featured BOOLEAN DEFAULT FALSE, -- Simple flag for manually featuring in Q1
    last_fetched TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(platform, external_id)
);
CREATE INDEX idx_external_source_platform_id ON external_source(platform, external_id);
CREATE INDEX idx_external_source_title ON external_source USING gin(to_tsvector('english', title));
CREATE INDEX idx_external_source_enrichment_status ON external_source(enrichment_status);
CREATE INDEX idx_external_source_is_featured ON external_source(is_featured);

-- Game Content Updates (For granular feed items like trailers, tweets)
CREATE TABLE game_content_updates (
    id BIGSERIAL PRIMARY KEY,
    fk_game_id BIGINT NOT NULL REFERENCES external_source(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'trailer_youtube', 'tweet'
    content_url TEXT, -- URL to the content (e.g., YouTube video, tweet URL)
    title TEXT, -- e.g., Trailer title, first line of tweet
    thumbnail_url TEXT, -- Optional: for display on cards
    published_at TIMESTAMPTZ, -- Publication date of the content item
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_game_content_updates_fk_game_id ON game_content_updates(fk_game_id);
CREATE INDEX idx_game_content_updates_published_at ON game_content_updates(published_at DESC);
CREATE INDEX idx_game_content_updates_content_type ON game_content_updates(content_type);

-- User Library
CREATE TABLE library (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_ref_id BIGINT NOT NULL REFERENCES external_source(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'wishlist', -- 'wishlist', 'playing', 'finished', etc.
    added_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY(user_id, game_ref_id)
);
CREATE INDEX idx_library_user_id ON library(user_id);

-- Note: `is_featured` on `external_source` handles simple Q1 featuring.
-- `game_content_updates` stores individual content pieces for the dynamic feed.
```

---

## 4. API Endpoints (v0)

*   Authentication: Handled by Supabase client libraries on the frontend, interfacing with Supabase Auth backend. API endpoints will require JWT validation.
*   Search (Keyword):
    *   `GET /api/search?q=<query>&platform=steam`
    *   Performs basic keyword text search against `external_source.title` for Steam games.
    *   (Natural language 'vibe check' queries are a post-v0 goal).
*   Game Details:
    *   `GET /api/games/external/<platform>/<external_id>` or `GET /api/games/<external_source_id>`
    *   Fetches details for a specific game from the `external_source` table, including any enriched data if available.
    *   `GET /api/games/core/<slug>` (May query `games_core` and join with `external_source` for full details)
    *   Fetches details for a manually curated/featured game.
*   Library Management: (Requires Authentication)
    *   `GET /api/library`
    *   Fetches the current user's library (list of game references from `external_source`).
    *   `POST /api/library`
    *   Body: `{ gameRefId: <external_source_id> }`
    *   Adds a game reference (from `external_source`) to the user's library. If the game's `enrichment_status` is 'pending', this action can signal the backend to prioritize its enrichment.
    *   `DELETE /api/library/<gameRefId>`
    *   Removes a game reference from the user's library.
    *   `PUT /api/library/<gameRefId>`
    *   Body: `{ status: <new_status> }` (Optional: For updating status later)
    *   Updates the status or other metadata of a library item.
*   **Feed Generation:**
    *   `GET /api/feed` (Requires Authentication)
    *   Constructs a personalized feed.
    *   Combines:
        *   **Semantically relevant new game recommendations:** Identified via vector similarity search (e.g., similar to games in user's library, or globally similar to highly-rated/featured indie games) using embeddings from the vector DB.
        *   Recent, relevant items from `game_content_updates` (trailers/tweets) for games in the user's library or for recommended new games.
        *   Potentially other interesting `game_content_updates` from non-library games (e.g., for generally trending or featured games).
    *   Returns a list of feed items, each with a type and associated data.

---

## 5. Crawler Logic (High-Level - v0)

*   **Steam Crawler (v0 Focus):**
    *   Target: Basic game info (ID, name, developer) **plus data needed for embeddings (descriptions, genres, tags, etc.)** into `external_source`.
    *   Update `enrichment_status` to 'basic_info_extracted'.
*   **Content Monitors (Simplified for v0 - Steam Focus):**
    *   **Trailer Monitor (YouTube):** For known Steam games, periodically check for new trailers. If found, add to `game_content_updates`.
    *   **Tweet Monitor (Twitter):** For known Steam games, monitor primary dev/game Twitter accounts. If relevant new tweets are found, add to `game_content_updates`.
    *   These monitors update the `enrichment_status` of the game in `external_source`.

---

## 6. AI Enrichment Service (v0 Focus)

*   **Semantic Embedding Generation:**
    *   For each game in `external_source` (once basic info is extracted), generate a semantic vector embedding (e.g., using Sentence-BERT on descriptions, tags, etc.).
    *   Store this embedding in the chosen Vector Database (e.g., Pinecone), linked to the game ID.
    *   Update `enrichment_status` in `external_source` to reflect embedding availability (e.g., 'embeddings_generated').
*   **Content Monitoring:** (As described in Crawler Logic - populating `game_content_updates` for trailers/tweets).
*   This service is crucial for enabling the semantically relevant recommendations in the feed.

---

## 7. Deployment

*   **API Service (Express):** Deployed as Serverless Functions on Vercel.
*   **Database/Auth:** Supabase handles hosting, scaling, and backups.
*   **Crawlers:** Deployed as Vercel Cron Jobs or scheduled via GitHub Actions workflows.

---

This MVP backend provides the foundational data ingestion, storage, and access patterns necessary for the initial IndieFindr experience, deferring more complex search and AI features to later iterations. 