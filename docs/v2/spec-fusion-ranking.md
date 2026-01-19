# Fusion Ranking

## Overview

V2 uses **Reciprocal Rank Fusion (RRF)** to combine results from multiple embedding searches. RRF is the industry standard for merging heterogeneous ranked lists.

## Why RRF?

| Problem | RRF Solution |
|---------|--------------|
| Different facets have different score scales | RRF uses ranks, not scores |
| Some facets may be missing for a game | Missing = high rank (1000), naturally deprioritized |
| Need to prioritize consensus | Games in multiple lists naturally score higher |
| Simple to implement | No training required |

## RRF Formula

```
score(game) = Σ (weight_i / (k + rank_i))
```

Where:
- `k = 60` (standard constant, dampens top rank advantage)
- `rank_i` = position in facet i's result list (1 = best)
- `weight_i` = importance weight for facet i

### Example

Game appears at:
- Tags: rank 3
- Vibe: rank 8
- Mechanics: rank 2
- Visual: not in top 50 (rank = 1000)

With equal weights (0.25 each):
```
score = 0.25/(60+3) + 0.25/(60+8) + 0.25/(60+2) + 0.25/(60+1000)
      = 0.00397 + 0.00368 + 0.00403 + 0.00024
      = 0.0119
```

Games matching multiple facets accumulate higher scores.

## Adaptive Weighting

Weights change based on game type:

### Weight Presets

```typescript
const WEIGHTS = {
  aesthetic: { 
    visual: 0.40, tags: 0.25, vibe: 0.25, mechanics: 0.10 
  },
  gameplay: { 
    visual: 0.10, tags: 0.35, vibe: 0.15, mechanics: 0.40 
  },
  narrative: { 
    visual: 0.15, tags: 0.25, vibe: 0.45, mechanics: 0.15 
  },
  balanced: { 
    visual: 0.25, tags: 0.25, vibe: 0.25, mechanics: 0.25 
  },
};
```

### User Override Presets

```typescript
const USER_PRESETS = {
  'similar-tags': { visual: 0.05, tags: 0.70, vibe: 0.15, mechanics: 0.10 },
  'visual':       { visual: 0.60, tags: 0.20, vibe: 0.15, mechanics: 0.05 },
  'gameplay':     { visual: 0.05, tags: 0.35, vibe: 0.10, mechanics: 0.50 },
  'vibe':         { visual: 0.20, tags: 0.20, vibe: 0.50, mechanics: 0.10 },
};
```

## Game Type Classification

Pre-computed during embedding generation (no AI needed):

```typescript
function classifyGameType(game: GameData): GameProfile {
  const signals = { aesthetic: 0, gameplay: 0, narrative: 0 };
  
  const tags = Object.keys(game.steamspyTags || {}).map(t => t.toLowerCase());
  
  // Aesthetic indicators
  const aestheticTags = ['pixel graphics', 'stylized', 'colorful', 
                         'atmospheric', 'beautiful', 'minimalist'];
  signals.aesthetic += tags.filter(t => 
    aestheticTags.some(at => t.includes(at))
  ).length;
  
  // Gameplay indicators
  const gameplayTags = ['roguelike', 'difficult', 'competitive', 
                        'pvp', 'skill-based', 'fast-paced'];
  signals.gameplay += tags.filter(t => 
    gameplayTags.some(gt => t.includes(gt))
  ).length;
  
  // Narrative indicators
  const narrativeTags = ['story rich', 'visual novel', 'choices matter', 
                         'narrative', 'emotional', 'character-driven'];
  signals.narrative += tags.filter(t => 
    narrativeTags.some(nt => t.includes(nt))
  ).length;
  
  // Determine winner
  const max = Math.max(signals.aesthetic, signals.gameplay, signals.narrative);
  const total = signals.aesthetic + signals.gameplay + signals.narrative;
  
  if (total === 0 || max < 2) {
    return { type: 'balanced', confidence: 0.5 };
  }
  
  if (signals.aesthetic === max) {
    return { type: 'aesthetic', confidence: signals.aesthetic / total };
  }
  if (signals.gameplay === max) {
    return { type: 'gameplay', confidence: signals.gameplay / total };
  }
  return { type: 'narrative', confidence: signals.narrative / total };
}
```

## Match Explanations

Instead of AI-generated explanations, v2 uses programmatic explanations based on matched facets:

```typescript
function generateExplanation(match: MatchResult): string {
  const facets = match.matchedFacets; // e.g., ['tags', 'vibe']
  
  if (facets.length >= 3) {
    return `Strong match across ${facets.join(', ')}`;
  }
  
  if (facets.includes('tags') && facets.includes('mechanics')) {
    return 'Similar gameplay and genre';
  }
  
  if (facets.includes('vibe') && facets.includes('tags')) {
    return 'Similar vibe and themes';
  }
  
  if (facets.includes('visual')) {
    return 'Similar visual style';
  }
  
  if (facets.length === 1) {
    return `Matched on ${facets[0]}`;
  }
  
  return 'Related game';
}
```

## Tuning

### Parameters to Tune

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| `k` (RRF constant) | 60 | 20-100 | Lower = more weight on top ranks |
| Per-facet LIMIT | 50 | 20-100 | More candidates = better recall, slower |
| Weight ratios | varies | 0-1 | Domain-specific, tune empirically |

### Benchmarking Approach

```typescript
// Compare v1 and v2 results
const v1Results = await getV1Suggestions(appid);
const v2Results = await findSimilarGamesV2(appid);

const metrics = {
  overlap: countOverlap(v1Results, v2Results),
  overlapTop5: countOverlap(v1Results.slice(0, 5), v2Results.slice(0, 5)),
  multiFacetRatio: v2Results.filter(r => r.matchedFacets.length >= 2).length / v2Results.length,
};
```

Adjust weights until:
- Overlap with v1 is >40% (validates quality)
- Multi-facet ratio is >70% (validates consensus)
