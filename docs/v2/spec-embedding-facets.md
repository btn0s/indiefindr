# Embedding Facets

## Overview

V2 uses 4 embedding facets to capture different dimensions of game similarity. Each facet is embedded separately and searched in parallel.

## Facets

### 1. TAGS (Primary)

The most valuable signal - community-curated tags from SteamSpy.

| Property | Value |
|----------|-------|
| Source | `steamspy_tags` (top 15 by weight) |
| Model | `text-embedding-3-small` |
| Dimensions | 1536 |
| Captures | Genre, mechanics, themes, player experience |

**Input format:**
```
Game tags: Roguelike, Pixel Graphics, Difficult, Indie, Action, Singleplayer, 2D, Procedural Generation
```

**Why tags are powerful:**
- Community-curated (players tag, not marketing)
- Weighted by votes (popular = representative)
- Covers mechanics, aesthetics, and themes

### 2. VIBE (Description tone)

Captures the emotional atmosphere and writing style.

| Property | Value |
|----------|-------|
| Source | `short_description` from Steam |
| Model | `text-embedding-3-small` |
| Dimensions | 1536 |
| Captures | Emotional tone, atmosphere, themes |

**Input format:** Raw description text (no preprocessing)

**Examples of what vibe captures:**
- "A harrowing descent into madness" → dark, tense, psychological
- "Cozy cafe where you serve magical creatures" → wholesome, relaxing
- "Gigantic crustacean festooned with cannons" → whimsical, quirky

### 3. MECHANICS (Gameplay systems)

Captures core gameplay loop and features.

| Property | Value |
|----------|-------|
| Source | `genres` + `categories` + mechanics-related tags |
| Model | `text-embedding-3-small` |
| Dimensions | 1536 |
| Captures | Core loop, features, systems |

**Input format:**
```
Genres: Action, Roguelike. Features: Single-player, Controller Support, Steam Achievements. Mechanics: Procedural Generation, Permadeath, Deckbuilding
```

**Mechanics keywords extracted from tags:**
- roguelike, roguelite, procedural, permadeath
- turn-based, real-time, crafting, building
- survival, open world, metroidvania, souls-like
- platformer, shooter, strategy, puzzle, simulation

### 4. VISUAL (Optional for v2.0)

Captures art style and visual aesthetics.

| Property | Value |
|----------|-------|
| Source | `screenshots[0]` or `header_image` |
| Model | TBD (OpenAI vision → description → embed, or CLIP) |
| Dimensions | 512-1536 |
| Captures | Art style, color palette, visual complexity |

**Options for v2.0:**
- **Skip** - Text facets may be sufficient
- **Header image** - Use OpenAI vision to describe, then embed description
- **CLIP** - Direct image embedding (requires additional API)

**Decision:** Start without visual, add in v2.1 if needed.

## Data Sources

### From Steam API (`games_new.raw`)

| Field | Used For |
|-------|----------|
| `short_description` | Vibe facet |
| `detailed_description` | Backup for vibe if short is empty |
| `genres` | Mechanics facet |
| `categories` | Mechanics facet |
| `screenshots` | Visual facet (future) |
| `developers` | Same-studio matching (exact match, not embedded) |

### From SteamSpy (`games_new.steamspy_tags`)

| Field | Used For |
|-------|----------|
| `tags` | Tags facet (primary signal) |
| `positive/negative` | Quality signal for ranking boost |
| `owners` | Popularity signal |

## Embedding Generation Code

```typescript
async function generateEmbeddings(game: GameData) {
  const embeddings: Partial<GameEmbeddings> = {};

  // 1. Tags (most important)
  if (game.steamspyTags && Object.keys(game.steamspyTags).length > 0) {
    const tagsText = formatTags(game.steamspyTags);
    embeddings.tags = await embed(tagsText);
  }

  // 2. Vibe
  if (game.short_description) {
    embeddings.vibe = await embed(game.short_description);
  }

  // 3. Mechanics
  const mechanicsText = formatMechanics(game);
  if (mechanicsText) {
    embeddings.mechanics = await embed(mechanicsText);
  }

  // 4. Visual (v2.1)
  // embeddings.visual = await embedImage(game.screenshots[0]);

  return embeddings;
}

function formatTags(tags: Record<string, number>): string {
  const sorted = Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag]) => tag);
  return `Game tags: ${sorted.join(', ')}`;
}

function formatMechanics(game: GameData): string {
  const parts: string[] = [];
  
  if (game.genres?.length) {
    parts.push(`Genres: ${game.genres.map(g => g.description).join(', ')}`);
  }
  
  if (game.categories?.length) {
    parts.push(`Features: ${game.categories.map(c => c.description).join(', ')}`);
  }
  
  const mechanicsTags = extractMechanicsTags(game.steamspyTags);
  if (mechanicsTags.length) {
    parts.push(`Mechanics: ${mechanicsTags.join(', ')}`);
  }
  
  return parts.join('. ');
}
```

## Facet Completeness

Not all games will have all facets:

| Scenario | Handling |
|----------|----------|
| No SteamSpy tags | Skip tags facet, rely on vibe + mechanics |
| No description | Skip vibe facet |
| New/obscure game | May only have 1-2 facets |

The RRF fusion handles missing facets gracefully - games with fewer facets simply have fewer ranking signals.
