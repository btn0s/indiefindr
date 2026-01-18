# Implementation Plan

This document outlines the phased implementation of v2, sequenced by effort with each phase delivering independent value.

## Phase Overview

| Phase | Focus | Effort | Cumulative | Value Delivered |
|-------|-------|--------|------------|-----------------|
| 1 | AESTHETIC (images) | ~20 hrs | 20 hrs | Visual similarity search |
| 2 | MECHANICS + NARRATIVE | ~24 hrs | 44 hrs | Text-based facets |
| 3 | IGDB enrichment | ~12 hrs | 56 hrs | Richer metadata |
| 4 | ATMOSPHERE (multimodal) | ~20 hrs | 76 hrs | Mood matching |
| 5 | DYNAMICS (video + reviews) | ~30 hrs | 106 hrs | Feel/pacing matching |
| 6 | Polish & advanced | ~20 hrs | 126 hrs | Cross-modal search, optimization |

---

## Phase 1: AESTHETIC Foundation

**Goal**: Get image embeddings working end-to-end for visual similarity.

### Deliverables
- [ ] Database migration for `game_embeddings` table
- [ ] SigLIP 2 integration via Replicate API
- [ ] AESTHETIC embedding generation pipeline
- [ ] `find_similar_games()` RPC function
- [ ] Backfill script for existing games
- [ ] Basic UI: "Visually Similar" section

### Technical Tasks

#### 1.1 Database Schema
```sql
-- See 04-database-schema.md for full schema
CREATE TABLE game_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appid INTEGER REFERENCES games_new(appid),
  facet TEXT NOT NULL,
  embedding vector(768),
  -- ... additional columns
);
```

**Effort**: 2 hours

#### 1.2 SigLIP 2 Integration

Options:
1. **Replicate API** (recommended for start)
   - Model: `lucataco/siglip` or similar
   - Cost: ~$0.0001 per image
   - No infrastructure to manage

2. **Self-hosted** (for scale)
   - Run on GPU server
   - Fixed cost, unlimited queries
   - More setup complexity

```typescript
// src/lib/embeddings/siglip.ts
import Replicate from "replicate";

const replicate = new Replicate();

export async function embedImage(imageUrl: string): Promise<number[]> {
  const output = await replicate.run("lucataco/siglip", {
    input: { image: imageUrl }
  });
  return output.embedding;
}
```

**Effort**: 4 hours

#### 1.3 Embedding Pipeline

```typescript
// src/lib/embeddings/aesthetic.ts
export async function generateAestheticEmbedding(
  appid: number
): Promise<number[]> {
  // 1. Fetch game data
  const game = await getGame(appid);

  // 2. Collect images
  const images = [
    game.header_image,
    ...game.screenshots.slice(0, 3)
  ].filter(Boolean);

  // 3. Embed each image
  const embeddings = await Promise.all(
    images.map(url => embedImage(url))
  );

  // 4. Weighted average (header=0.4, screenshots=0.2 each)
  const weights = [0.4, 0.2, 0.2, 0.2];
  const averaged = weightedAverage(embeddings, weights);

  // 5. L2 normalize
  return normalize(averaged);
}
```

**Effort**: 4 hours

#### 1.4 Similarity Search Function

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
) AS $$
-- See 04-database-schema.md for implementation
$$;
```

**Effort**: 2 hours

#### 1.5 Backfill Script

```typescript
// scripts/backfill-aesthetic-embeddings.ts
async function backfillAesthetic() {
  const games = await getAllGames();

  for (const game of games) {
    console.log(`Processing ${game.title}...`);

    const embedding = await generateAestheticEmbedding(game.appid);

    await supabase.from("game_embeddings").upsert({
      appid: game.appid,
      facet: "aesthetic",
      embedding,
      source_type: "image",
      source_data: { images: getImageUrls(game) },
      embedding_model: "siglip2-base-patch16-224",
    });

    // Rate limiting
    await sleep(500);
  }
}
```

**Effort**: 4 hours

#### 1.6 UI Integration

```tsx
// src/app/games/[appid]/similar-section.tsx
export async function SimilarSection({ appid }: { appid: number }) {
  const similar = await supabase.rpc("find_similar_games", {
    p_appid: appid,
    p_facet: "aesthetic",
    p_limit: 8,
  });

  return (
    <section>
      <h2>Visually Similar</h2>
      <div className="grid grid-cols-4 gap-4">
        {similar.map((game) => (
          <GameCard
            key={game.appid}
            game={game}
            similarity={game.similarity}
          />
        ))}
      </div>
    </section>
  );
}
```

**Effort**: 4 hours

### Phase 1 Total: ~20 hours

---

## Phase 2: Text Facets (MECHANICS + NARRATIVE)

**Goal**: Add text-based facets using structured templates.

### Deliverables
- [ ] MECHANICS embedding pipeline
- [ ] NARRATIVE embedding pipeline
- [ ] Tag normalization system
- [ ] Multi-facet UI with toggle buttons
- [ ] Weighted combination search
- [ ] Backfill existing games

### Technical Tasks

#### 2.1 Tag Normalization

```typescript
// src/lib/embeddings/tags.ts
const TAG_SYNONYMS: Record<string, string> = {
  "Souls-like": "soulslike",
  "Soulslike": "soulslike",
  "Soulsborne": "soulslike",
  "Rogue-like": "roguelike",
  "Roguelite": "roguelike",
  "Rogue-lite": "roguelike",
  "Metroidvania": "metroidvania",
  "MetroidVania": "metroidvania",
  // ... more mappings
};

export function normalizeTags(tags: string[]): string[] {
  return tags.map(tag => TAG_SYNONYMS[tag] || tag.toLowerCase());
}
```

**Effort**: 4 hours

#### 2.2 MECHANICS Template Builder

```typescript
// src/lib/embeddings/mechanics.ts
export function buildMechanicsText(game: GameWithMetadata): string {
  const genres = game.raw?.genres?.map(g => g.description) || [];
  const tags = normalizeTags(Object.keys(game.steamspy_tags || {}));

  // Categorize tags
  const mechanicTags = tags.filter(t => MECHANIC_TAGS.has(t));
  const perspectiveTags = tags.filter(t => PERSPECTIVE_TAGS.has(t));
  const modeTags = inferGameModes(game);

  return `
Genre: ${genres.join(", ")}
Perspective: ${perspectiveTags.join(", ") || "Unknown"}
Core mechanics: ${mechanicTags.slice(0, 8).join(", ")}
Game modes: ${modeTags.join(", ")}
Subgenre: ${inferSubgenre(tags)}
  `.trim();
}
```

**Effort**: 4 hours

#### 2.3 NARRATIVE Template Builder

```typescript
// src/lib/embeddings/narrative.ts
export function buildNarrativeText(game: GameWithMetadata): string {
  const themes = inferThemes(game);
  const setting = inferSetting(game);
  const fantasy = inferPlayerFantasy(game);

  return `
Setting: ${setting}
Themes: ${themes.join(", ")}
Story: ${game.short_description}
Fantasy: ${fantasy}
Tone: ${inferNarrativeTone(game)}
  `.trim();
}
```

**Effort**: 4 hours

#### 2.4 Text Embedding Integration

```typescript
// src/lib/embeddings/text.ts
import { embed } from "ai";

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: "openai/text-embedding-3-small",
    value: text,
  });

  // Project from 1536 to 768 dimensions for consistency
  return projectDimensions(embedding, 768);
}
```

**Effort**: 2 hours

#### 2.5 Multi-Facet Search Function

```sql
CREATE OR REPLACE FUNCTION find_similar_games_weighted(
  p_appid INTEGER,
  p_weights JSONB,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  appid INTEGER,
  title TEXT,
  header_image TEXT,
  weighted_similarity FLOAT,
  facet_scores JSONB
) AS $$
-- See 04-database-schema.md
$$;
```

**Effort**: 4 hours

#### 2.6 UI: Facet Toggles

```tsx
// src/app/games/[appid]/faceted-similar.tsx
const FACETS = [
  { id: "all", label: "All", weights: { aesthetic: 0.33, mechanics: 0.34, narrative: 0.33 } },
  { id: "aesthetic", label: "Looks Like", weights: { aesthetic: 1 } },
  { id: "mechanics", label: "Plays Like", weights: { mechanics: 1 } },
  { id: "narrative", label: "About", weights: { narrative: 1 } },
];

export function FacetedSimilar({ appid }: { appid: number }) {
  const [activeFacet, setActiveFacet] = useState("all");

  return (
    <section>
      <div className="flex gap-2 mb-4">
        {FACETS.map((facet) => (
          <button
            key={facet.id}
            onClick={() => setActiveFacet(facet.id)}
            className={activeFacet === facet.id ? "active" : ""}
          >
            {facet.label}
          </button>
        ))}
      </div>
      <SimilarGames appid={appid} weights={FACETS.find(f => f.id === activeFacet)!.weights} />
    </section>
  );
}
```

**Effort**: 6 hours

### Phase 2 Total: ~24 hours

---

## Phase 3: IGDB Enrichment

**Goal**: Integrate IGDB for richer structured metadata.

### Deliverables
- [ ] IGDB API client with Twitch OAuth
- [ ] `game_igdb_data` table
- [ ] Fetch themes, keywords, perspectives, game_modes
- [ ] Update MECHANICS/NARRATIVE with IGDB data
- [ ] Backfill existing games

### Technical Tasks

#### 3.1 IGDB API Client

```typescript
// src/lib/igdb/client.ts
import { Client } from "igdb-api-node";

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

  return accessToken;
}

export async function searchIGDB(steamAppId: number) {
  const token = await getAccessToken();

  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID!,
      "Authorization": `Bearer ${token}`,
    },
    body: `
      fields name, themes.name, keywords.name,
             player_perspectives.name, game_modes.name,
             storyline, game_engines.name;
      where external_games.uid = "${steamAppId}"
        & external_games.category = 1;
    `,
  });

  return response.json();
}
```

**Effort**: 4 hours

#### 3.2 IGDB Data Table

```sql
CREATE TABLE game_igdb_data (
  appid INTEGER PRIMARY KEY REFERENCES games_new(appid),
  igdb_id INTEGER,
  themes TEXT[],
  keywords TEXT[],
  player_perspectives TEXT[],
  game_modes TEXT[],
  game_engines TEXT[],
  storyline TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Effort**: 1 hour

#### 3.3 Enrichment Pipeline

```typescript
// src/lib/igdb/enrich.ts
export async function enrichGameWithIGDB(appid: number): Promise<void> {
  const igdbData = await searchIGDB(appid);

  if (!igdbData || igdbData.length === 0) {
    console.log(`No IGDB data for ${appid}`);
    return;
  }

  const game = igdbData[0];

  await supabase.from("game_igdb_data").upsert({
    appid,
    igdb_id: game.id,
    themes: game.themes?.map(t => t.name) || [],
    keywords: game.keywords?.map(k => k.name) || [],
    player_perspectives: game.player_perspectives?.map(p => p.name) || [],
    game_modes: game.game_modes?.map(m => m.name) || [],
    game_engines: game.game_engines?.map(e => e.name) || [],
    storyline: game.storyline,
  });
}
```

**Effort**: 3 hours

#### 3.4 Update Template Builders

Update MECHANICS and NARRATIVE templates to use IGDB data when available.

**Effort**: 2 hours

#### 3.5 Backfill Script

**Effort**: 2 hours

### Phase 3 Total: ~12 hours

---

## Phase 4: ATMOSPHERE (Multimodal)

**Goal**: Create mood/vibe matching combining visual and text signals.

### Deliverables
- [ ] Mood tag extraction and normalization
- [ ] Screenshot mood analysis pipeline
- [ ] ATMOSPHERE embedding (visual + text hybrid)
- [ ] "Feels Like" search functionality
- [ ] Quality validation

### Technical Tasks

#### 4.1 Mood Tag Vocabulary

```typescript
// src/lib/embeddings/mood.ts
const MOOD_TAGS = {
  cozy: ["Cozy", "Relaxing", "Peaceful", "Wholesome", "Cute"],
  dark: ["Dark", "Atmospheric", "Horror", "Psychological Horror"],
  tense: ["Thriller", "Suspense", "Tense"],
  whimsical: ["Colorful", "Surreal", "Quirky", "Fantasy"],
  melancholic: ["Emotional", "Story Rich", "Choices Matter"],
  action: ["Fast-Paced", "Action", "Intense"],
};

export function extractMoodTags(tags: string[]): string[] {
  const moods: string[] = [];
  for (const [mood, indicators] of Object.entries(MOOD_TAGS)) {
    if (tags.some(t => indicators.includes(t))) {
      moods.push(mood);
    }
  }
  return moods;
}
```

**Effort**: 4 hours

#### 4.2 Vision-Language Analysis (Optional)

```typescript
// src/lib/embeddings/atmosphere-vision.ts
export async function analyzeScreenshotMood(
  screenshotUrls: string[]
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Describe the emotional atmosphere and mood of this game
                 based on these screenshots. Use terms like: cozy, tense,
                 melancholic, whimsical, oppressive, serene, chaotic,
                 mysterious, nostalgic. Be specific and concise.`,
        },
        ...screenshotUrls.map(url => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ],
    }],
    max_tokens: 200,
  });

  return response.choices[0].message.content || "";
}
```

**Effort**: 6 hours

#### 4.3 Hybrid Embedding

```typescript
// src/lib/embeddings/atmosphere.ts
export async function generateAtmosphereEmbedding(
  appid: number
): Promise<number[]> {
  // Get visual embedding (from AESTHETIC)
  const aesthetic = await getAestheticEmbedding(appid);

  // Get mood text
  const game = await getGame(appid);
  const moodTags = extractMoodTags(Object.keys(game.steamspy_tags || {}));

  // Optionally: analyze screenshots with vision model
  // const visionMood = await analyzeScreenshotMood(game.screenshots);

  const moodText = `
    Mood: ${moodTags.join(", ")}
    Atmosphere: ${inferAtmosphere(game)}
    ${game.short_description}
  `;

  const textEmbedding = await embedText(moodText);

  // Combine: 60% visual, 40% text
  const combined = combineEmbeddings([
    { embedding: aesthetic, weight: 0.6 },
    { embedding: textEmbedding, weight: 0.4 },
  ]);

  return normalize(combined);
}
```

**Effort**: 6 hours

#### 4.4 UI Updates + Validation

**Effort**: 4 hours

### Phase 4 Total: ~20 hours

---

## Phase 5: DYNAMICS (Video + Reviews)

**Goal**: Capture pacing, intensity, and "game feel".

### Deliverables
- [ ] Steam review fetching and storage
- [ ] Review mining for feel descriptors
- [ ] Video trailer analysis pipeline
- [ ] DYNAMICS embedding
- [ ] "Flows Like" search

### Technical Tasks

#### 5.1 Review Fetching

```typescript
// src/lib/steam/reviews.ts
export async function fetchReviews(appid: number): Promise<Review[]> {
  const response = await fetch(
    `https://store.steampowered.com/appreviews/${appid}?json=1&num_per_page=100&filter=recent&language=english`
  );
  const data = await response.json();
  return data.reviews;
}
```

**Effort**: 4 hours

#### 5.2 Review Mining

```typescript
// src/lib/embeddings/dynamics-mining.ts
const DYNAMICS_PATTERNS = [
  { pattern: /(feels?|felt) (very |so |really )?(tight|floaty|responsive|smooth)/i, category: "controls" },
  { pattern: /(fast|slow|relaxing|frantic|methodical)[- ]paced/i, category: "pacing" },
  { pattern: /(satisfying|juicy|punchy|meaty) (combat|gameplay)/i, category: "feedback" },
  { pattern: /(quick|short|long) (sessions?|runs?)/i, category: "session" },
];

export function extractDynamicsDescriptors(reviews: string[]): DynamicsProfile {
  const descriptors: Record<string, string[]> = {};

  for (const review of reviews) {
    for (const { pattern, category } of DYNAMICS_PATTERNS) {
      const match = review.match(pattern);
      if (match) {
        descriptors[category] = descriptors[category] || [];
        descriptors[category].push(match[0]);
      }
    }
  }

  return aggregateDescriptors(descriptors);
}
```

**Effort**: 8 hours

#### 5.3 Video Analysis (Optional)

```typescript
// src/lib/embeddings/dynamics-video.ts
export async function analyzeGameplayVideo(videoUrl: string): Promise<number[]> {
  // Option 1: Frame sampling + motion analysis
  const frames = await extractFrames(videoUrl, 20);
  const frameEmbeddings = await Promise.all(frames.map(embedImage));

  // Compute motion/change vectors between frames
  const motionVectors = computeMotionVectors(frameEmbeddings);

  // Aggregate into dynamics embedding
  return aggregateDynamics(frameEmbeddings, motionVectors);
}
```

**Effort**: 12 hours

#### 5.4 Combined DYNAMICS Embedding

```typescript
export async function generateDynamicsEmbedding(
  appid: number
): Promise<number[]> {
  const game = await getGame(appid);

  // Text-based (from reviews + tags)
  const reviews = await fetchReviews(appid);
  const profile = extractDynamicsDescriptors(reviews.map(r => r.review));

  const dynamicsText = `
    Controls: ${profile.controls || "unknown"}
    Pacing: ${profile.pacing || "unknown"}
    Feedback: ${profile.feedback || "unknown"}
    Session length: ${profile.session || "unknown"}
    Tags: ${getPacingTags(game).join(", ")}
  `;

  return embedText(dynamicsText);
}
```

**Effort**: 6 hours

### Phase 5 Total: ~30 hours

---

## Phase 6: Polish & Advanced Features

**Goal**: Cross-modal search, optimization, quality tuning.

### Deliverables
- [ ] Text-to-game search
- [ ] Image-to-game search
- [ ] Facet weight presets
- [ ] Performance optimization
- [ ] Quality evaluation framework
- [ ] A/B test infrastructure

### Technical Tasks

#### 6.1 Text-to-Game Search

```typescript
// src/lib/search/text-to-game.ts
export async function searchByText(query: string): Promise<Game[]> {
  // Embed query with SigLIP text encoder
  const queryEmbedding = await embedTextWithSiglip(query);

  // Search AESTHETIC embeddings (compatible with text)
  const results = await supabase.rpc("search_games_by_embedding", {
    p_query_embedding: queryEmbedding,
    p_facet: "aesthetic",
    p_limit: 20,
  });

  return results;
}
```

**Effort**: 6 hours

#### 6.2 Image-to-Game Search

```typescript
// src/lib/search/image-to-game.ts
export async function searchByImage(imageUrl: string): Promise<Game[]> {
  const imageEmbedding = await embedImage(imageUrl);

  const results = await supabase.rpc("search_games_by_embedding", {
    p_query_embedding: imageEmbedding,
    p_facet: "aesthetic",
    p_limit: 20,
  });

  return results;
}
```

**Effort**: 4 hours

#### 6.3 Facet Presets

```typescript
const PRESETS = {
  "vibe-seeker": {
    label: "Vibe Seeker",
    description: "Prioritizes mood and atmosphere",
    weights: { atmosphere: 0.5, aesthetic: 0.3, narrative: 0.2 },
  },
  "mechanics-match": {
    label: "Gameplay Match",
    description: "Prioritizes similar gameplay",
    weights: { mechanics: 0.6, dynamics: 0.4 },
  },
  "visual-twin": {
    label: "Visual Twin",
    description: "Prioritizes art style",
    weights: { aesthetic: 1.0 },
  },
};
```

**Effort**: 4 hours

#### 6.4 Performance Optimization

- Index tuning (HNSW parameters)
- Query caching
- Batch embedding generation
- Connection pooling

**Effort**: 6 hours

### Phase 6 Total: ~20 hours

---

## Dependencies

### API Keys Required
- `OPENAI_API_KEY` - For text embeddings
- `REPLICATE_API_TOKEN` - For SigLIP image embeddings
- `TWITCH_CLIENT_ID` - For IGDB API
- `TWITCH_CLIENT_SECRET` - For IGDB API

### New Dependencies
```json
{
  "replicate": "^0.25.0",
  "igdb-api-node": "^5.0.0"
}
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Embedding coverage | 100% of games | Count games with all facets |
| Query latency | <100ms p95 | Supabase metrics |
| Relevance | >80% approval | Human evaluation |
| User engagement | +20% clicks | A/B test vs v1 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SigLIP API rate limits | Batch processing, caching |
| IGDB data gaps | Fallback to Steam-only data |
| Embedding quality | Iterative tuning, human eval |
| Cost overruns | Budget alerts, batching |

---

## References

- [Replicate SigLIP Model](https://replicate.com/lucataco/siglip)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [IGDB API Docs](https://api-docs.igdb.com/)
- [pgvector HNSW Tuning](https://github.com/pgvector/pgvector#hnsw)
- [Supabase Vector Guide](https://supabase.com/docs/guides/ai/vector-columns)
