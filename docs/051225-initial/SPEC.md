# IndieFindr — Product Design & Architecture (Draft)

> **Purpose**  A single-source reference that explains *what* IndieFindr will do, *how* it works end-to-end, and *where* AI super-powers the Discover → Curate → Play loop.

---

## 1 · Product Narrative

IndieFindr is **the human-centric, AI-amplified discovery layer for indie games**. It scours the web and every major store to uncover promising titles, enriches each with trailers, devlogs, social buzz and platform availability, and then lets players (solo or in groups) curate a living library they can launch in one click. The loop is simple:

1. **Discover** – Search or browse; AI surfaces hidden gems and context.
2. **Curate** – Add to personal or group shelves; tag, note, up-vote.
3. **Play** – Deep-link into the right launcher or cloud session; track play-time.
4. **Repeat** – Recommendations refresh with each interaction, sharpening taste models.

---

## 2 · Experience Pillars

| Pillar               | What it means                                                                                                                   | Why it matters                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| *Indie-first*        | Curated catalogue is opt-in and quality-gated. External index is available but visually secondary.                              | Trust & focus—players aren't drowned by AAA noise. |
| *Context-rich cards* | Every game page auto-pulls trailers (YouTube), dev diaries (YouTube/Twitch), screenshots, recent tweets, platform + price grid. | Users grasp the vibe instantly; no tab-hopping.    |
| *AI transparency*    | Explain *why* each rec appears and let users tweak weights (e.g., "More experimental", "Less horror").                          | Control builds confidence and data improves model. |
| *Social curation*    | Group rooms, shared lists, votes, notes.                                                                                        | Discovery becomes collaborative and sticky.        |
| *Low-friction play*  | One-click launch via deep link or cloud; optional helper app tracks minutes.                                                    | Immediate payoff reinforces the loop.              |

---

## 3 · Functional Map

### 3.1 Discover (v0 Focus)

*   **Semantic Recommendation Feed (`/`):** The primary discovery mechanism. Queries against an internal index of **Steam games** (v0) with semantic embeddings.
*   **AI Enrichment Service (v0 Core):**
    *   Generates **Semantic Embeddings** from Steam game descriptions/tags, stored in Vector DB.
*   **Result layout / Feed Generation (v0):** The main feed (`/`) uses **semantic embeddings** for relevant new game recommendations. Basic keyword search available for direct lookups.

### 3.2 Curate

*   **Server Actions** `addToLibrary`, `addToGroup`, `tagGame`, `writeNote` operate on game references.
*   Adding a game with basic info can trigger the **AI Enrichment Service**.
*   **Live presence** via WebSocket hub; list updates stream to all group members.
*   **Tag voting** (lightweight folksonomy) informs global tag confidence.

### 3.3 Play

* **Launch page** renders deep links (Steam, itch, Xbox, Epic, GOG) & cloud links (Nvidia GeForce NOW, xCloud) when available.
* **Desktop/Tauri helper** (optional):

  1. Registers custom URL scheme `indiefindr://play/{gameId}`.
  2. Calls Steam/Playnite APIs to launch locally.
  3. Polls for play-time; posts back via WebSocket.

### 3.4 AI-Driven Feedback Loop

* Nightly batch job retrains similarity vectors with new interactions.
* LLM summarizer rewrites long descriptions into concise blurbs (<300 chars).
* Embedding store (Pinecone) allows fast **"Because you liked …"** rails.

---

## 4 · System Architecture (High Level - v0 Focus)

*Tech Stack Summary (v0):* Next.js 15 (App Router) with Tailwind CSS/shadcn/ui for frontend; Node.js/Express API; Vercel AI SDK for embedding model calls; Postgres (Supabase) for primary data; Pinecone for vectors.

```mermaid
flowchart TB
  subgraph Web Layer (Next.js v0)
    Edge[/Edge Route – feed/search/] -- SSR/ISR --> Users
    RSC[React Server Components]
    Client[Client Components]
  end
  subgraph Data Input (v0)
    CSV[Manual CSV Input] --> Ingest
  end
  Edge -->|query| SearchAPI
  RSC -->|Server Action| CoreAPI
  Client -->|Action Trigger| CoreAPI
  subgraph Services (v0)
    Ingest[CSV Ingestion Worker]
    SearchAPI[Search Service (PG FTS)]
    CoreAPI[Core API (Express/Vercel)]
    Enrich[Steam Enrichment Worker]
    EmbedGen[AI Embedding Gen]
    VectorDB[(Vector Store - Pinecone)]
    GameDB[(Game DB - Postgres)]
  end
  Ingest --> Enrich
  Enrich --> GameDB
  Enrich --> EmbedGen
  EmbedGen --> VectorDB 
  EmbedGen --> GameDB // Update status
  SearchAPI --> GameDB
  CoreAPI --> GameDB & VectorDB // For recommendations
```
*Description (v0 Focus):* A manual CSV seeds Steam AppIDs. An Enrichment Worker fetches data from Steam for those IDs, storing it in Postgres. An Embedding Generator creates vectors from the text data and stores them in Pinecone. The Core API handles user actions and queries Pinecone for recommendations. Keyword search uses Postgres.

---

## 5 · Data Model Snap-Shot (v0 - Hyper Simplified)

```sql
-- games (Steam Only for v0)
id                bigint PK
platform          text DEFAULT 'steam' NOT NULL
external_id       text UNIQUE -- Steam AppID
slug              text UNIQUE -- generated for routing
title             text
-- Text fields for embeddings:
dedescription_short TEXT
description_detailed TEXT
genres            TEXT[]
tags              TEXT[]
raw_data          jsonb     -- original steam data
media             jsonb     -- basic thumbnails, hero (from Steam data)
enrichment_status text      -- pending, basic_info_extracted, embedding_generated, embedding_failed
is_featured       boolean DEFAULT FALSE
-- (Vector itself is stored in Pinecone, linked by id/external_id)

-- library (Simplified wishlist for v0)
owner_id    uuid -- User ID
game_id     bigint FK -> games(id)
added_at    timestamp
PRIMARY KEY(owner_id, game_id)

-- NO game_content_updates for v0
-- NO play_session for v0
```

---

## 6 · Key AI Components (v0 Focus)

*   **Similarity Vector Generator:** Uses model (e.g., Sentence-BERT) on Steam game data (descriptions, tags) to create embeddings. Stores in Vector DB (Pinecone).

---

## 7 · Front-End Design (Next .js - v0 Focus)

*   **Framework:** Next.js 15 (App Router)
*   **Styling:** Tailwind CSS, shadcn/ui
*   **AI SDK Usage:** For v0, backend use of Vercel AI SDK (`ai/core` or provider packages) for embedding generation. Frontend will use standard data fetching; `ai/rsc` and advanced `ai/react` features are deferred.

### Routing (v0)
```
/                – Personalized semantic recommendation feed (RSC)
/game/[slug]      – Game detail (ISR, shows Steam link)
/profile          – My saved games (library)
```

### Component Patterns

* **RSC for data-heavy sections** → streamed to client.
* **Client Components** only for interactions (add, vote, notes).
* **Suspense boundaries** show skeleton cards instantly.

---

## 8 · Operational Concerns (v0 Simplified)
* Focus on core API uptime, DB/VectorDB health, Steam crawler reliability.

---

## 9 · Roadmap Milestones

| Version | Deliverable                                                                 |
| ------ | --------------------------------------------------------------------------- |
| **v0 (Pareto MVP)** | Next.js skeleton, **Manual CSV Ingestion**, Steam **Enrichment Worker** (+ embedding data), Vector DB setup, Semantic Embedding generation, basic keyword search (PG FTS), simplified personal library (save/view), core semantic recommendation feed. |

---

## 10 · Future Development (v1+)

*   **Automated Steam Crawler:** Build a crawler to automatically discover new Steam games and keep existing ones updated, replacing the manual CSV input.
*   **Platform Expansion:** Add Itch.io, GOG, Game Pass, Epic crawlers.
*   **Granular Content Feed & Richer Game Pages:** Introduce `game_content_updates` table and monitors (Trailers, Tweets, Devlogs) to enrich the feed and game pages. Display this content dynamically.
*   **Advanced AI & "Vibe Check" Search:** 
    *   LLM Summaries, Explainers, Sentiment Analysis.
    *   Natural Language "Vibe Check" Search (e.g., "chill rainy day game") using combined embeddings, sentiment, tags.
    *   More sophisticated recommendation algorithms (e.g., collaborative filtering, hybrid models).
*   **Enhanced Library:** Statuses (Playing, Finished), Notes, Tags, Sorting/Filtering.
*   **Social Features:** Groups, Shared Libraries, Voting, shared recommendations.
*   **Enhanced Search:** Integrate Vector Search / ElasticSearch for richer keyword and semantic queries.
*   **Desktop Helper / Play Tracking.**
*   **Realtime Updates.**
*   **Richer Media Handling:** More advanced processing of screenshots, videos.
*   **Detailed User Profiles & Taste Models.**

---

### End of Draft

> **Next up:**
>
> 1. Validate each ingestion source's TOS.
> 2. Spike Enrichment worker → YouTube + Twitter proof-of-concept.
> 3. Design low-fidelity wireframes for Discover & Game pages.
