# Backend Design (MVP) - IndieFindr

> **Goal:** Define the core backend components required to support the Q1 MVP features: Steam & itch.io data ingestion, basic search across ingested data, user authentication, and personal game libraries. This design prioritizes simplicity and aligns with the 80/20 principle, deferring more complex AI/Search components.

---

## 1. Technology Stack (MVP)

*   **Runtime:** Node.js
*   **API Framework:** Express.js (Deployed as Vercel Serverless Functions)
*   **Database:** PostgreSQL (Hosted on Supabase)
*   **Authentication:** Supabase Auth (Handles user accounts, JWTs, social logins)
*   **Crawlers:** Node.js scripts (Run manually or via scheduled jobs like Vercel Cron or GitHub Actions)
*   **Deployment:** Vercel (API, Cron Jobs), Supabase (Database, Auth)

---

## 2. Core Components

1.  **API Service (`CoreAPI`)**
    *   Built with Express.js, running as serverless functions on Vercel.
    *   Handles all incoming requests from the Next.js frontend.
    *   Interacts with Supabase for database operations and authentication checks.

2.  **Database (PostgreSQL on Supabase)**
    *   Consolidates `CoreDB` and `FederatedDB` from the main spec into a single Postgres instance for MVP simplicity.
    *   Stores user data (via Supabase Auth), ingested game data, and user library associations.

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

-- External Sources (Federated Index Data)
CREATE TABLE external_source (
    id          BIGSERIAL PRIMARY KEY,
    platform    TEXT NOT NULL, -- 'steam', 'itch'
    external_id TEXT NOT NULL, -- Game ID on the external platform
    title       TEXT,
    developer   TEXT,
    raw_data    JSONB,         -- Store raw response for future processing
    last_fetched TIMESTAMPTZ DEFAULT now(),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(platform, external_id) -- Ensure no duplicates per platform
);
CREATE INDEX idx_external_source_platform_id ON external_source(platform, external_id);
CREATE INDEX idx_external_source_title ON external_source USING gin(to_tsvector('english', title)); -- Basic full-text search

-- Games Core (Minimal for MVP - Future Curation Target)
-- Represents games officially curated/added to IndieFindr's core list.
-- Might be manually populated or empty initially in MVP.
CREATE TABLE games_core (
    id          BIGSERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL, -- URL-friendly identifier
    title       TEXT,
    developer   TEXT,
    -- Other canonical fields added later (releaseDate, etc.)
    fk_external BIGINT REFERENCES external_source(id) NULL, -- Link back if ingested
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_games_core_slug ON games_core(slug);

-- User Library
CREATE TABLE library (
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_ref_type TEXT NOT NULL CHECK (game_ref_type IN ('core', 'external')), -- 'core' or 'external'
    game_ref_id BIGINT NOT NULL, -- FK to either games_core.id or external_source.id
    status      TEXT DEFAULT 'wishlist', -- 'wishlist', 'playing', 'finished', etc.
    added_at    TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY(user_id, game_ref_type, game_ref_id)
);
CREATE INDEX idx_library_user_id ON library(user_id);

-- Note: Consider adding a view to simplify querying games across core/external later.
```

---

## 4. API Endpoints (MVP)

*   **Authentication:** Handled by Supabase client libraries on the frontend, interfacing with Supabase Auth backend. API endpoints will require JWT validation.
*   **Search:**
    *   `GET /api/search?q=<query>&platform=<steam|itch|all>`
    *   Performs basic text search (using Postgres `to_tsvector`) against `external_source.title` and potentially `games_core.title`.
    *   Returns a list of matching games (primarily from `external_source` in MVP).
*   **Game Details:**
    *   `GET /api/games/external/<platform>/<external_id>`
    *   Fetches details for a specific game from the `external_source` table.
    *   `GET /api/games/core/<slug>` (Less critical for MVP if `games_core` is sparse)
    *   Fetches details for a specific game from the `games_core` table.
*   **Library Management:** (Requires Authentication)
    *   `GET /api/library`
    *   Fetches the current user's library (list of game references).
    *   `POST /api/library`
    *   Body: `{ gameRefType: 'external' | 'core', gameRefId: <id> }`
    *   Adds a game reference to the user's library.
    *   `DELETE /api/library/<gameRefType>/<gameRefId>`
    *   Removes a game reference from the user's library.
    *   `PUT /api/library/<gameRefType>/<gameRefId>`
    *   Body: `{ status: <new_status> }` (Optional: For updating status later)
    *   Updates the status or other metadata of a library item.

---

## 5. Crawler Logic (High-Level)

*   **Steam Crawler:**
    *   Use available Steam APIs (if any suitable unofficial ones exist and comply with TOS) or carefully managed scraping.
    *   Target: Basic game info (ID, name, developer).
    *   Action: `INSERT ... ON CONFLICT (platform, external_id) DO UPDATE` into `external_source` table.
*   **Itch.io Crawler:**
    *   Use itch.io API (if available) or scraping (respecting `robots.txt` and rate limits).
    *   Target: Basic game info.
    *   Action: `INSERT ... ON CONFLICT (platform, external_id) DO UPDATE` into `external_source` table.
*   **Scheduling:** Use Vercel Cron Jobs or GitHub Actions to run crawlers periodically (e.g., daily). Implement locking or checks to prevent concurrent runs.

---

## 6. Authentication Flow

1.  **Frontend:** Uses Supabase JS client library (`@supabase/auth-helpers-nextjs`) to handle sign-up, sign-in (email/password, social providers).
2.  **Supabase:** Manages user pool, issues JWTs upon successful authentication.
3.  **Frontend:** Stores JWT securely (managed by auth helpers). Attaches JWT (`Authorization: Bearer <token>`) to requests to the API Service.
4.  **API Service:** Uses middleware (e.g., with `@supabase/supabase-js` on the server-side or custom JWT validation) to verify the token on protected endpoints (like `/api/library`). Extracts user ID from the validated token to perform user-specific actions.

---

## 7. Deployment

*   **API Service (Express):** Deployed as Serverless Functions on Vercel.
*   **Database/Auth:** Supabase handles hosting, scaling, and backups.
*   **Crawlers:** Deployed as Vercel Cron Jobs or scheduled via GitHub Actions workflows.

---

This MVP backend provides the foundational data ingestion, storage, and access patterns necessary for the initial IndieFindr experience, deferring more complex search and AI features to later iterations. 