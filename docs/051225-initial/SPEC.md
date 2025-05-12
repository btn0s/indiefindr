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

### 3.1 Discover

*   **Unified search/browse** (Edge Route) queries against an internal index built initially from **Steam (v0)**, expanding later.
*   **AI Enrichment Service** runs asynchronously to add:
    *   (v0) **Semantic Embeddings:** Generated from game descriptions/tags, stored in Vector DB.
    *   (v0) YouTube trailers, Primary Tweets -> `game_content_updates`.
    *   (v1+) Sentiment summary, Advanced social buzz, LLM Summaries, etc. -> `games.content_ai`.
    *   (v1+) Platform & price matrix.
*   **Result layout / Feed Generation**: The primary feed (`/`) uses **semantic embeddings (v0)** for relevant new game recommendations, blended with granular content updates (trailers/tweets) from `game_content_updates`. Basic keyword search available. Natural language / 'vibe check' search queries are a post-v0 goal.

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

## 4 · System Architecture (High Level)

```mermaid
flowchart TB
  subgraph Web Layer (Next.js 15)
    Edge[/Edge Route – search/discover/] -- SSR/ISR --> Users
    RSC[React Server Components]
    Client[Client Components]
  end
  Edge -->|query| SearchAPI
  RSC -->|Server Action| CoreAPI
  Client -->|Action Trigger| CoreAPI
  subgraph Services
    SearchAPI[Search Service\n(PG FTS -> Elastic + Pinecone)]
    CoreAPI[Core API (Express/Vercel node runtime)]
    Enrich[AI Enrichment Worker]
    Crawler[Platform Crawlers]
    RT[Realtime Hub]
  end
  Crawler --> GameDB[(Unified Game DB - Postgres)]
  Enrich --> GameDB
  Enrich --> VectorDB[(Vector Store - Pinecone)]
  SearchAPI --> GameDB & VectorDB
  CoreAPI --> GameDB & RT & VectorDB
  RT <--> Client
```
*Description:* Steam Crawler feeds Postgres. The Enrichment Worker adds **semantic embeddings to Pinecone (v0)** and basic content updates (trailers/tweets) to Postgres (v0). Richer AI data (summaries, sentiment) added v1+. The Core API handles actions and reads/writes from Postgres and **queries Pinecone for recommendations (v0)**. Search uses Postgres (v0 keyword search) evolving to use VectorDB/Elastic (v1+ for advanced/NL search). Frontend interacts as before.

---

## 5 · Data Model Snap-Shot (simplified)

```sql
-- games (Unified store for all indexed games)
id                bigint PK
platform          text      -- source: "steam", "itch", ...
external_id       text
slug              text UNIQUE -- generated when enriched/curated
title             text
dev_pub           jsonb     -- developer, publisher
raw_data          jsonb     -- original data from source
media             jsonb     -- thumbnails, hero image (added by enrichment)
content_ai        jsonb     -- aiSummary, hypeScore, sentiment (Q2+ enrichment)
enrichment_status text      -- pending, basic_info_extracted, content_processing, content_enriched, failed
is_featured      boolean DEFAULT FALSE -- Simple flag for manual featuring (Q1)
vector            vector(768) -- *Generated in v0, stored in Vector DB (e.g., Pinecone)*
last_fetched_at   timestamp
last_enriched_at  timestamp
UNIQUE(platform, external_id)

-- game_content_updates (Granular items for feed, v0 focus: trailers, tweets)
id                bigint PK
fk_game_id        bigint FK -> games(id)
content_type      text      -- 'trailer_youtube', 'tweet', 'devlog'(Q2+), etc.
content_url       text
title             text
thumbnail_url     text
published_at      timestamp

-- library (user & group shared - groups v1+)
owner_type  enum('user','group')
owner_id    uuid
game_id     bigint FK -> games(id)
status      enum('wishlist','playing','finished')
notes       text
user_tags   text[]
PRIMARY KEY(owner_type, owner_id, game_id)

-- play_session (if included in v0)
user_id     uuid
game_id     bigint FK -> games(id)
minutes     int
source      text
recorded_at timestamp
```
*Note:* The `vector` field conceptually represents the embedding generated in v0, which is stored and queried in a dedicated Vector DB like Pinecone.

---

## 6 · Key AI Components
(Operated by the **AI Enrichment Service** - Phased Rollout)

**v0 (MVP) Focus:**
*   **Similarity Vector Generator:** Uses model (e.g., Sentence-BERT) on Steam game data (descriptions, tags) to create embeddings. Stores in Vector DB.
*   **Trailer Finder (Simplified):** Identifies official YouTube trailers for Steam games, stores link/metadata in `game_content_updates`.
*   **Social Monitor (Simplified):** Identifies key tweets from primary dev/game accounts for Steam games, stores link/text in `game_content_updates`.

**v1 (Q2+) Focus (Deferred Components):**

| Component             | Model / Service                             | Task                                                     |
| --------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **"Vibe Check" Search Engine** | Sentiment Models, Embeddings (Game + Query), LLM | Understand natural language search queries, combine sentiment, tags, etc., for semantic matching. |
| **Tag Extractor**     | MiniLM embeddings + K-means on corpus       | Auto-generate candidate tags from description & reviews. |
| **Similarity Vector** | Sentence-BERT (all-mpnet-base-v2)           | 768-d game embedding for k-NN recs & 'vibe check'.       |
| **Trailer Finder (Advanced)**| OpenAI function-calling + Google Search API | Generate YouTube Search query & rank results (broader scope).|
| **Social Monitor (Advanced)**| Twitter API stream + sentiment LLM          | Track broader buzz; raise "trending" flags, sentiment analysis. |
| **Explainer**         | Small GPT-3.5 call                          | 1-sentence "Recommended because …" description.          |
| **Summarizer**        | LLM (e.g., GPT-3.5/4)                       | Rewrite long descriptions into concise blurbs.           |

Semantic recommendations in the v0 feed are driven by querying the Vector DB using the generated Similarity Vectors.

---

## 7 · Front-End Design (Next .js)

### Routing

```
/                – Personalized feed (RSC)
/discover         – Global search
/groups/[id]      – Group hub (children: /discover, /library)
/game/[slug]      – Game detail (ISR, partial prerender)
/play/[gameId]    – Launch helper
/profile          – My stats & settings
```

### Component Patterns

* **RSC for data-heavy sections** → streamed to client.
* **Client Components** only for interactions (add, vote, notes).
* **Suspense boundaries** show skeleton cards instantly.

---

## 8 · Operational Concerns

* **Rate limiting** – 3rd-party APIs behind adaptive queue.
* **Content policy** – Respect Steam assets; cache thumbs only until game curated.
* **Moderation** – Role-based; audit log tables & soft delete.
* **Observability** – OpenTelemetry traces from Edge through Search & Core.
* **Compliance** – GDPR/CCPA ready; data export per user.

---

## 9 · Roadmap Milestones (Quarter-level)

| Q      | Deliverable                                                                 |
| ------ | --------------------------------------------------------------------------- |
| **v0 (Q1)** | Next.js skeleton, Steam crawler (+ embedding data), **Vector DB setup, Semantic Embedding generation**, basic search (PG FTS), personal library, **granular feed with semantic recommendations** & basic content updates (trailers/tweets). |
| **v1 (Q2)** | Itch.io crawler, **"Vibe Check" natural language search (initial)**, AI Enrichment Phase 2 (LLM summary, sentiment?), group rooms. |
| **v2 (Q3)** | Desktop helper alpha, advanced social buzz tracking, refined "Vibe Check" / ranking & explainer, more platform crawlers. |
| **v3 (Q4)** | Further platform expansion, monetization hooks, public launch. |

---

### End of Draft

> **Next up:**
>
> 1. Validate each ingestion source's TOS.
> 2. Spike Enrichment worker → YouTube + Twitter proof-of-concept.
> 3. Design low-fidelity wireframes for Discover & Game pages.
