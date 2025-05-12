# IndieFindr — Product Design & Architecture (Draft)

> **Purpose**  A single‐source reference that explains *what* IndieFindr will do, *how* it works end‑to‑end, and *where* AI super‑powers the Discover → Curate → Play loop.

---

## 1 · Product Narrative

IndieFindr is **the human‑centric, AI‑amplified discovery layer for indie games**. It scours the web and every major store to uncover promising titles, enriches each with trailers, devlogs, social buzz and platform availability, and then lets players (solo or in groups) curate a living library they can launch in one click. The loop is simple:

1. **Discover** – Search or browse; AI surfaces hidden gems and context.
2. **Curate** – Add to personal or group shelves; tag, note, up‑vote.
3. **Play** – Deep‑link into the right launcher or cloud session; track play‑time.
4. **Repeat** – Recommendations refresh with each interaction, sharpening taste models.

---

## 2 · Experience Pillars

| Pillar               | What it means                                                                                                                   | Why it matters                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| *Indie‑first*        | Curated catalogue is opt‑in and quality‑gated. External index is available but visually secondary.                              | Trust & focus—players aren’t drowned by AAA noise. |
| *Context‑rich cards* | Every game page auto‑pulls trailers (YouTube), dev diaries (YouTube/Twitch), screenshots, recent tweets, platform + price grid. | Users grasp the vibe instantly; no tab‑hopping.    |
| *AI transparency*    | Explain *why* each rec appears and let users tweak weights (e.g., “More experimental”, “Less horror”).                          | Control builds confidence and data improves model. |
| *Social curation*    | Group rooms, shared lists, votes, notes.                                                                                        | Discovery becomes collaborative and sticky.        |
| *Low‑friction play*  | One‑click launch via deep link or cloud; optional helper app tracks minutes.                                                    | Immediate payoff reinforces the loop.              |

---

## 3 · Functional Map

### 3.1 Discover

* **Unified search** (Edge Route) hits two indices:

  * *Core Catalogue* (quality‑gated).
  * *Federated Index* (Steam, itch, Game Pass PC, Epic, etc.).
* **AI Enrichment Service** adds:

  * YouTube trailers/devlogs (via Data API v3).
  * Latest 10 tweets from dev account or game hashtag (Twitter API v2).
  * Sentiment summary + hype score.
  * Platform & price matrix (store scrapers / partner APIs).
* **Result layout**: *On IndieFindr* rail first; “Add to IndieFindr” cards below.

### 3.2 Curate

* **Server Actions** `addToLibrary`, `addToGroup`, `tagGame`, `writeNote`.
* **Live presence** via WebSocket hub; list updates stream to all group members.
* **Tag voting** (lightweight folksonomy) informs global tag confidence.

### 3.3 Play

* **Launch page** renders deep links (Steam, itch, Xbox, Epic, GOG) & cloud links (Nvidia GeForce NOW, xCloud) when available.
* **Desktop/Tauri helper** (optional):

  1. Registers custom URL scheme `indiefindr://play/{gameId}`.
  2. Calls Steam/Playnite APIs to launch locally.
  3. Polls for play‑time; posts back via WebSocket.

### 3.4 AI‑Driven Feedback Loop

* Nightly batch job retrains similarity vectors with new interactions.
* LLM summarizer rewrites long descriptions into concise blurbs (<300 chars).
* Embedding store (Pinecone) allows fast **"Because you liked …"** rails.

---

## 4 · System Architecture (High Level)

```mermaid
flowchart TB
  subgraph Web Layer (Next.js 15)
    Edge[/Edge Route – search/] -- SSR/ISR --> Users
    RSC[React Server Components]
    Client[Client Components]
  end
  Edge -->|query| SearchAPI
  RSC -->|Server Action| CoreAPI
  subgraph Services
    SearchAPI[Search Service\nElastic + Pinecone]
    CoreAPI[Core API (Express/Vercel node runtime)]
    Enrich[AI Enrichment Worker]
    Crawler[Platform Crawlers]
    RT[Realtime Hub]
  end
  Crawler --> FederatedDB[(Federated Index)]
  Crawler --> CoreDB[(Postgres – Core)]
  Enrich --> CoreDB
  SearchAPI --> FederatedDB & CoreDB & Pinecone
  CoreAPI --> CoreDB & RT
  RT <--> Client
```

---

## 5 · Data Model Snap‑Shot (simplified)

```sql
-- games_core
id          bigint PK
slug        text UNIQUE
canonical   jsonb      -- title, dev, pub, releaseDate
media       jsonb      -- thumbnails, hero image
content_ai  jsonb      -- aiSummary, hypeScore, sentiment
vector      vector(768)

-- external_source
id          bigint PK
platform    text      -- "steam", "itch", ...
external_id text
raw         jsonb
fk_core     bigint FK  -- nullable until curated

-- library (user & group shared)
owner_type  enum('user','group')
owner_id    uuid
game_id     bigint FK
status      enum('wishlist','playing','finished')
notes       text
user_tags   text[]
PRIMARY KEY(owner_type, owner_id, game_id)

-- play_session
user_id     uuid
game_id     bigint
minutes     int
source      text
recorded_at timestamp
```

---

## 6 · Key AI Components

| Component             | Model / Service                             | Task                                                     |
| --------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Tag Extractor**     | MiniLM embeddings + K‑means on corpus       | Auto‑generate candidate tags from description & reviews. |
| **Similarity Vector** | Sentence‑BERT (all‑mpnet‑base‑v2)           | 768‑d game embedding for k‑NN recs.                      |
| **Trailer Finder**    | OpenAI function‑calling + Google Search API | Generate YouTube Search query & rank results.            |
| **Social Monitor**    | Twitter API stream + sentiment LLM          | Track buzz; raise “trending” flags.                      |
| **Explainer**         | Small GPT‑3.5 call                          | 1‑sentence “Recommended because …” description.          |

All calls are wrapped in **LangChain orchestration** with retry & caching.

---

## 7 · Front‑End Design (Next .js)

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

* **RSC for data‑heavy sections** → streamed to client.
* **Client Components** only for interactions (add, vote, notes).
* **Suspense boundaries** show skeleton cards instantly.

---

## 8 · Operational Concerns

* **Rate limiting** – 3rd‑party APIs behind adaptive queue.
* **Content policy** – Respect Steam assets; cache thumbs only until game curated.
* **Moderation** – Role‑based; audit log tables & soft delete.
* **Observability** – OpenTelemetry traces from Edge through Search & Core.
* **Compliance** – GDPR/CCPA ready; data export per user.

---

## 9 · Roadmap Milestones (Quarter‑level)

| Q      | Deliverable                                                                 |
| ------ | --------------------------------------------------------------------------- |
| **Q1** | Next.js skeleton, Steam+itch crawler, dual‑index search, personal library.  |
| **Q2** | AI Enrichment (trailers, LLM summary), group rooms, basic rec rails.        |
| **Q3** | Desktop helper alpha, social buzz tracking, tweaked ranking & explainer.    |
| **Q4** | Multi‑platform ingest (Game Pass, Epic), monetization hooks, public launch. |

---

### End of Draft

> **Next up:**
>
> 1. Validate each ingestion source’s TOS.
> 2. Spike Enrichment worker → YouTube + Twitter proof‑of‑concept.
> 3. Design low‑fidelity wireframes for Discover & Game pages.
