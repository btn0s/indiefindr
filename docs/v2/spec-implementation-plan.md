# Implementation Plan

## Overview

Phased rollout to validate the approach before full commitment.

## Phase 1: Foundation (3-4 days)

**Goal:** Generate and store embeddings for a few games.

### Tasks

- [ ] Create migration: `game_embeddings_v2` table
- [ ] Create `src/lib/v2/types.ts` with types
- [ ] Create `src/lib/v2/config.ts` with weights and thresholds
- [ ] Create `src/lib/v2/embeddings.ts`:
  - `generateGameEmbeddings(appid)` - generate all facets
  - `formatTagsForEmbedding(tags)` - format tags text
  - `formatMechanicsForEmbedding(game)` - format mechanics text
- [ ] Create `POST /api/v2/embed` endpoint
- [ ] Test: Generate embeddings for 10 diverse games
- [ ] Verify embeddings stored correctly in database

### Validation

```bash
# Generate embeddings for a test game
curl -X POST http://localhost:3000/api/v2/embed \
  -H "Content-Type: application/json" \
  -d '{"appid": 1145360}'

# Check database
SELECT appid, game_type, 
       tags_embedding IS NOT NULL as has_tags,
       vibe_embedding IS NOT NULL as has_vibe
FROM game_embeddings_v2;
```

---

## Phase 2: Search (3-4 days)

**Goal:** Find similar games using RRF fusion.

### Tasks

- [ ] Create `find_similar_games_v2` SQL function
- [ ] Create `src/lib/v2/similarity.ts`:
  - `findSimilarGames(appid, options)` - main search function
  - `getWeightsForPreference(preference, profile)` - weight selection
- [ ] Create `GET /api/v2/similar/[appid]` endpoint
- [ ] Test: Find similar games for test games
- [ ] Verify results are reasonable

### Validation

```bash
# Find similar games
curl "http://localhost:3000/api/v2/similar/1145360?debug=true"

# Check timing
# Should be <100ms for query execution
```

---

## Phase 3: Profile & Weighting (2-3 days)

**Goal:** Adaptive weights based on game type.

### Tasks

- [ ] Create `src/lib/v2/profile.ts`:
  - `classifyGameType(game)` - heuristic classification
  - Tag lists for each category
- [ ] Update embedding generation to include profile
- [ ] Update similarity search to use adaptive weights
- [ ] Add `preference` param for user override
- [ ] Test across different game types:
  - Aesthetic game (e.g., Journey, Gris)
  - Gameplay game (e.g., Hades, Dead Cells)
  - Narrative game (e.g., Disco Elysium)

### Validation

```bash
# Check that aesthetic games get visual weight boost
curl "http://localhost:3000/api/v2/similar/738210?debug=true"  # Gris

# Check that gameplay games get mechanics weight boost
curl "http://localhost:3000/api/v2/similar/1145360?debug=true" # Hades
```

---

## Phase 4: Backfill & Benchmark (3-4 days)

**Goal:** Populate all games and compare to v1.

### Tasks

- [ ] Create `scripts/v2/backfill-embeddings.ts`:
  - Fetch all games from `games_new`
  - Generate embeddings in batches
  - Handle rate limiting
  - Progress reporting
- [ ] Create `scripts/v2/benchmark.ts`:
  - Compare v1 and v2 results for N games
  - Calculate overlap metrics
  - Output report
- [ ] Run backfill for all existing games
- [ ] Run benchmark and analyze results
- [ ] Tune weights based on benchmark

### Validation

```bash
# Run backfill
npx tsx scripts/v2/backfill-embeddings.ts

# Run benchmark
npx tsx scripts/v2/benchmark.ts --count=50

# Expected output:
# Average v1/v2 overlap: 45%
# Average multi-facet ratio: 72%
# Average query time: 38ms
```

---

## Phase 5: Visual Embeddings (Future)

**Goal:** Add screenshot-based visual matching.

### Options to Evaluate

1. **OpenAI Vision → Description → Embed**
   - Use GPT-4o to describe screenshot
   - Embed the description
   - Pros: Simple, uses existing infra
   - Cons: Extra API call, may lose visual nuance

2. **CLIP API (Replicate/HuggingFace)**
   - Direct image → embedding
   - Pros: Purpose-built for visual similarity
   - Cons: Additional service dependency

3. **Skip for v2**
   - Text facets may be sufficient
   - Evaluate based on Phase 4 results

### Decision Criteria

- If Phase 4 benchmark shows >50% v1 overlap without visual: skip
- If aesthetic games underperform: add visual
- Cost/complexity tradeoff

---

## File Checklist

### Phase 1
```
[ ] supabase/migrations/2026XXXX_add_v2_embeddings.sql
[ ] src/lib/v2/types.ts
[ ] src/lib/v2/config.ts
[ ] src/lib/v2/embeddings.ts
[ ] src/app/api/v2/embed/route.ts
```

### Phase 2
```
[ ] src/lib/v2/similarity.ts
[ ] src/app/api/v2/similar/[appid]/route.ts
```

### Phase 3
```
[ ] src/lib/v2/profile.ts
```

### Phase 4
```
[ ] scripts/v2/backfill-embeddings.ts
[ ] scripts/v2/benchmark.ts
[ ] src/app/api/v2/batch-embed/route.ts
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Embeddings don't capture similarity well | Phase 2 validates before backfill |
| Query too slow | HNSW indexes, tune ef_search |
| OpenAI rate limits during backfill | Batch with delays, track progress |
| V2 results worse than V1 | Keep V1 running, A/B test |
| SteamSpy data missing for some games | Graceful fallback to other facets |

---

## Success Criteria

Before considering v2 "ready":

- [ ] Query latency p95 < 100ms
- [ ] >70% of results match 2+ facets
- [ ] >40% overlap with v1 top 10
- [ ] Works for all game types (aesthetic, gameplay, narrative)
- [ ] Backfill completed for all existing games
