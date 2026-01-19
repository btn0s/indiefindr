# IndieFindr v2: Embedding-Based Similarity Search

## Overview

V2 is an experimental parallel system that replaces AI-driven suggestion generation with **pre-computed multi-faceted embeddings** and **fusion ranking**. The goal is instant similarity search with zero AI post-processing.

### Why V2?

| Current (v1) | Proposed (v2) |
|--------------|---------------|
| 30-60 seconds per game | <100ms per query |
| $0.01-0.02 per game (AI calls) | ~$0.001 per game (embedding only) |
| AI-generated at query time | Pre-computed embeddings |
| Single "vibe" understanding | Multi-faceted matching |
| Unpredictable (AI variance) | Deterministic results |

### Core Concept

Instead of asking AI "what games are similar?", we:

1. **Pre-compute embeddings** across multiple facets (tags, vibe, mechanics, visual)
2. **Store them** in pgvector with HNSW indexes
3. **Search all facets** in parallel at query time
4. **Fuse results** using RRF (Reciprocal Rank Fusion)
5. **Rank by consensus** - games matching multiple facets score higher

### Key Principles

- **No AI at query time** - all matching is vector similarity
- **Multi-faceted** - different games match on different dimensions
- **Adaptive weighting** - aesthetic games weight visuals higher, gameplay games weight mechanics higher
- **Completely isolated** - v2 lives in its own namespace, no v1 changes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Query Flow                             │
├─────────────────────────────────────────────────────────────┤
│  User searches game                                         │
│       ↓                                                     │
│  Get source game embeddings from game_embeddings_v2         │
│       ↓                                                     │
│  Parallel vector search across 4 facets (tags, vibe, etc)   │
│       ↓                                                     │
│  RRF fusion: combine ranks with weights                     │
│       ↓                                                     │
│  Return top 10 with match explanations                      │
│                                                             │
│  Total time: <100ms                                         │
└─────────────────────────────────────────────────────────────┘
```

## Spec Documents

| Document | Description |
|----------|-------------|
| [Embedding Facets](./spec-embedding-facets.md) | What we embed and why |
| [Database Schema](./spec-database-schema.md) | Tables, indexes, functions |
| [API Routes](./spec-api-routes.md) | V2 endpoints |
| [Fusion Ranking](./spec-fusion-ranking.md) | RRF algorithm and weighting |
| [Implementation Plan](./spec-implementation-plan.md) | Phased rollout |

## File Structure

```
src/
├── lib/v2/
│   ├── embeddings.ts      # Generate embeddings for a game
│   ├── similarity.ts      # Find similar games via RRF
│   ├── profile.ts         # Game type classification
│   ├── types.ts           # V2 types
│   └── config.ts          # Weights and thresholds
│
├── app/api/v2/
│   ├── embed/route.ts           # POST: Generate embeddings
│   ├── similar/[appid]/route.ts # GET: Find similar games
│   └── batch-embed/route.ts     # POST: Batch processing
│
scripts/v2/
├── backfill-embeddings.ts  # Backfill existing games
└── benchmark.ts            # Compare v1 vs v2 quality

supabase/migrations/
└── 2026XXXX_add_v2_embeddings.sql
```

## Success Metrics

| Metric | Target |
|--------|--------|
| Query latency (p95) | <100ms |
| Facet coverage | >70% results match 2+ facets |
| V1 quality overlap | >40% overlap in top 10 |
| AI calls per query | 0 |

## Open Questions

1. **Visual embeddings** - Skip for v2.0 or include via OpenAI vision?
2. **Explanations** - Programmatic ("Matched: Roguelike, Pixel Art") or AI-generated?
3. **Cold start** - Sync embed on ingest or background job?

See [Implementation Plan](./spec-implementation-plan.md) for phased approach.
