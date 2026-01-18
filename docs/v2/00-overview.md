# IndieFindr v2: Semantic Game Matching

## Vision

Build a semantic game matching system that understands games across multiple facets (visual, emotional, mechanical, thematic, dynamic) and lets users discover similar games by the dimensions they care about most—like [Cosmos](https://www.cosmos.so/) for games.

## Why v2?

The current system (v1) has fundamental limitations:

| Aspect | v1 (Current) | v2 (Proposed) |
|--------|--------------|---------------|
| **How it works** | AI generates search queries → Perplexity finds games → AI curates | Embed games in vector space → similarity search |
| **New game visibility** | Invisible until re-ingestion | Instant—just embed once |
| **Cost per query** | ~$0.01+ (API calls) | $0 (vector math) |
| **Consistency** | LLM variability | Deterministic |
| **User control** | None | Filter by facet |
| **Speed** | 5-10 seconds | <100ms |

## The Five Facets

v2 introduces a research-backed model of how players think about game similarity:

| Facet | User Label | What It Captures |
|-------|------------|------------------|
| **AESTHETIC** | "Looks Like" | Art style, visual design, color palette |
| **ATMOSPHERE** | "Feels Like" | Emotional mood, tone, vibe |
| **MECHANICS** | "Plays Like" | Core loop, controls, genre conventions |
| **NARRATIVE** | "About" | Theme, setting, story, fantasy |
| **DYNAMICS** | "Flows Like" | Pacing, intensity, game feel |

## Documentation

| Document | Description |
|----------|-------------|
| [01-research.md](./01-research.md) | Research on player psychology and game categorization |
| [02-facet-model.md](./02-facet-model.md) | Detailed facet definitions and data sources |
| [03-implementation-plan.md](./03-implementation-plan.md) | Phased implementation with effort estimates |
| [04-database-schema.md](./04-database-schema.md) | Complete SQL schema for embeddings |
| [05-whitepaper-outline.md](./05-whitepaper-outline.md) | Academic paper structure |

## Tech Stack

- **Image Embeddings**: SigLIP 2 (768-dim vectors)
- **Text Embeddings**: OpenAI text-embedding-3-small (1536-dim)
- **Vector Database**: Supabase pgvector with HNSW indexes
- **Video Analysis**: TBD (Phase 5)
- **Data Enrichment**: IGDB API for themes, keywords, perspectives

## Implementation Phases

```
Phase 1: AESTHETIC (images)          ~20 hours   ████████░░░░░░░░
Phase 2: MECHANICS + NARRATIVE       ~24 hours   ████████████░░░░
Phase 3: IGDB enrichment             ~12 hours   ██████░░░░░░░░░░
Phase 4: ATMOSPHERE (multimodal)     ~20 hours   ████████████░░░░
Phase 5: DYNAMICS (video + reviews)  ~30 hours   ████████████████
Phase 6: Polish & advanced           ~20 hours   ████████████░░░░
                                    ─────────
                              Total: ~126 hours
```

## Key Benefits

1. **Automatic Updates**: New games instantly become comparable to all existing games
2. **Faceted Control**: Users choose what matters to them
3. **Explainable**: Similarity scores per facet, not black-box AI
4. **Scalable**: Embed once, query infinitely
5. **Fast**: Sub-100ms queries via pgvector

## Getting Started

See [03-implementation-plan.md](./03-implementation-plan.md) for Phase 1 setup instructions.
