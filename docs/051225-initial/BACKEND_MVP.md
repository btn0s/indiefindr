# Backend Design (MVP) - IndieFindr

> **Goal:** Define the core backend components for v0 (MVP) to deliver a **minimal lovable product** focused on **AI-driven semantic game discovery**. This includes: Steam data ingestion, generation of semantic game embeddings, user authentication, basic personal game libraries (save/view), and a simple feed featuring **semantically relevant new game recommendations**. All other features (granular content updates, multi-platform support, advanced AI, groups, etc.) are deferred to post-v0.

---

## 1. Technology Stack (v0)

*   Runtime: Node.js
*   API Framework: Express.js (Deployed as Vercel Serverless Functions)
*   **Frontend Framework:** Next.js 15 (App Router)
*   **UI:** Tailwind CSS, shadcn/ui
*   Database (Primary Data): PostgreSQL (Hosted on Supabase)
*   Database (Vector Embeddings): Pinecone (or similar vector DB)
*   **AI Model Interaction (Embeddings):** Vercel AI SDK (`ai/core` or provider packages)
*   Authentication: Supabase Auth
*   Crawlers/Enrichment: Node.js scripts
*   Deployment: Vercel, Supabase, Pinecone

---

## 2. Core Components (v0)

1.  **API Service (`CoreAPI`):** Handles auth, library saves, feed requests, game detail lookups.
2.  **Database (PostgreSQL):** Stores `external_source` (Steam games initiated from CSV) and `library` data.
3.  **Database (Vector DB):** Stores semantic embeddings for games.
4.  **CSV Ingestion Worker:** Reads initial list of Steam AppIDs from a predefined CSV.
5.  **Steam Enrichment Worker:** For a given Steam AppID, fetches game data needed for display and embeddings from Steam.
6.  **AI Embedding Generation Service (v0):** Generates embeddings from enriched data and stores them in the Vector DB.

---

## 3. Database Schema (v0 - Hyper Simplified)

```sql
-- Users table (Managed by Supabase Auth)

-- External Sources (Primary game data table - Steam Only for v0)
CREATE TABLE external_source (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT DEFAULT 'steam' NOT NULL, -- Hardcoded to steam for v0
    external_id TEXT NOT NULL UNIQUE, -- Steam AppID
    title TEXT,
    developer TEXT,
    -- Key text fields for embedding generation (e.g., short description, detailed description, genres, tags from Steam)
    description_short TEXT,
    description_detailed TEXT,
    genres TEXT[],
    tags TEXT[],
    raw_data JSONB, -- Store raw Steam response for reference
    enrichment_status TEXT DEFAULT 'pending' NOT NULL, -- pending, basic_info_extracted, embedding_generated, embedding_failed
    is_featured BOOLEAN DEFAULT FALSE, -- Simple flag for potential manual boosting
    steam_appid TEXT UNIQUE, -- Explicit Steam AppID maybe useful
    last_fetched TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_external_source_external_id ON external_source(external_id);
CREATE INDEX idx_external_source_title ON external_source USING gin(to_tsvector('english', title));
CREATE INDEX idx_external_source_enrichment_status ON external_source(enrichment_status);

-- User Library (Simplified for v0 - essentially a wishlist)
CREATE TABLE library (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_ref_id BIGINT NOT NULL REFERENCES external_source(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY(user_id, game_ref_id)
);
CREATE INDEX idx_library_user_id ON library(user_id);

-- Note: `game_content_updates` table is removed for v0 simplicity.
```

---

## 4. API Endpoints (v0)

*   **Authentication:** (As before)
*   **Search (Keyword):** `GET /api/search?q=<query>` (Searches `external_source.title` via PG FTS).
*   **Game Details:** `GET /api/games/<external_source_id>` (Fetches from `external_source`, may show Steam link).
*   **Library Management:**
    *   `GET /api/library`: Fetches user's saved games (from `library`).
    *   `POST /api/library`: Body: `{ gameRefId: <external_source_id> }`. Adds game to library.
    *   `DELETE /api/library/<gameRefId>`: Removes game from library.
*   **Feed Generation:**
    *   `GET /api/feed` (Requires Authentication)
    *   Constructs a personalized feed based on **semantic similarity**.
    *   Logic: Identify games user has saved (`library`), query Vector DB for similar games, return list of recommended `external_source` game IDs/basic data.
    *   Returns a list of recommended game items.

---

## 5. Ingestion & Enrichment Logic (v0)

*   **Initial Seed:** System starts by reading a predefined CSV containing Steam AppIDs.
*   **Enrichment Trigger:** For each AppID from the CSV, trigger the Steam Enrichment Worker.
*   **Steam Enrichment Worker:**
    *   Input: Steam AppID.
    *   Action: Fetch game info (ID, name, developer, descriptions, genres, tags) from Steam API/Store pages.
    *   Output: Store/update data in `external_source` table.
    *   Update `enrichment_status` to 'basic_info_extracted'.
*   **(No automated Crawlers/Monitors for v0)**

---

## 6. AI Embedding Generation Service (v0 Focus)

*   **Trigger:** Runs after `basic_info_extracted` status is set.
*   **Input:** Text data from `external_source` (description, tags, genres, etc.).
*   **Action:** Generate semantic vector embedding.
*   **Output:** Store embedding in the Vector Database, linked to the game ID.
*   Update `enrichment_status` in `external_source` to 'embedding_generated'.

---

## 7. Deployment (v0)

*   API Service (Express/Vercel)
*   Database (Supabase Postgres)
*   Vector Database (Pinecone)
*   Crawler/Enrichment jobs (Vercel Cron or similar)

---

## 8. Future Plans (v1+)

*   **Automated Steam Crawler:** Build a crawler to automatically discover new Steam games and keep existing ones updated, replacing the manual CSV input.
*   **Platform Expansion:** Add Itch.io, GOG, Game Pass, Epic crawlers.
*   **Granular Content Feed:** Introduce `game_content_updates` table and monitors (Trailers, Tweets, Devlogs) to enrich the feed.
*   **Advanced AI:** LLM Summaries, Explainers, Sentiment Analysis, "Vibe Check" Natural Language Search.
*   **Enhanced Library:** Statuses (Playing, Finished), Notes, Tags, Sorting/Filtering.
*   **Social Features:** Groups, Shared Libraries, Voting.
*   **Enhanced Search:** Integrate Vector Search / ElasticSearch for richer queries.
*   **Desktop Helper / Play Tracking.**
*   **Realtime Updates.**

This hyper-focused v0 aims to nail the core semantic discovery loop first. 