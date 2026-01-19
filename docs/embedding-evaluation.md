# Embedding Evaluation System

This document explains how we evaluate the quality of game embeddings.

## Overview

The embedding system converts games into vectors across multiple facets (aesthetic, atmosphere, mechanics, narrative). The evaluation system answers: **do similar games end up with similar vectors?**

## Ground Truth Dataset

Location: `scripts/ground-truth-realistic.json`

A curated list of game pairs with human-labeled expected similarity:

| Level | Threshold | Example |
|-------|-----------|---------|
| `very_high` | ≥75% | Borderlands 2 ↔ Borderlands 3 (same series) |
| `high` | ≥68% | Cat Bait ↔ Katanaut (both soulslike) |
| `moderate` | 58-72% | Bear's Restaurant ↔ Tales of Seikyu (both cozy) |
| `low` | ≤55% | Borderlands 2 ↔ Bear's Restaurant (shooter vs cozy) |

## How Similarity is Calculated

1. Fetch embeddings for both games from each facet
2. Calculate cosine similarity between vectors
3. Average across available facets

```
Game A                      Game B
  aesthetic: [0.1, 0.3...]    aesthetic: [0.8, 0.1...]
  atmosphere: [...]           atmosphere: [...]
  mechanics: [...]            mechanics: [...]
  narrative: [...]            narrative: [...]

Cosine similarity per facet → Average → Compare to threshold
```

## Key Metrics

### Accuracy
Simple pass/fail rate. Did similarity fall within expected threshold?

### Discrimination Gap
**The most important metric.** Difference between avg similarity of "high" pairs vs "low" pairs.

```
High similarity pairs avg: 67.5%
Low similarity pairs avg:  60.0%
Gap: 7.5%
```

Target: >15% gap. If high and low pairs score similarly, the model can't distinguish them.

### Facet Correlation
How well each facet's scores correlate with expected similarity:

| Facet | Correlation | Interpretation |
|-------|-------------|----------------|
| 0.9+ | Excellent | Facet strongly predicts similarity |
| 0.5-0.9 | Good | Facet contributes meaningfully |
| 0.2-0.5 | Mediocre | Facet has weak signal |
| <0.2 | Poor | Basically random |

### Facet Agreement
Do facets agree with each other? Negative correlation means facets contradict.

## Running Evaluations

### Full Evaluation
```bash
npx tsx scripts/eval-comprehensive.ts
```

Shows all metrics, per-category breakdown, failures, and close calls.

### Regression Testing
```bash
# Save current metrics as baseline
npx tsx scripts/eval-regression.ts baseline

# Check for regressions (run after changes)
npx tsx scripts/eval-regression.ts
```

Detects if accuracy or facet correlations dropped after changes.

### Backfill Embeddings
```bash
npx tsx scripts/backfill-ground-truth.ts
```

Ensures all test games have embeddings before running eval.

## Current Baseline (as of initial setup)

| Metric | Value | Target |
|--------|-------|--------|
| Accuracy | 35.7% | >70% |
| Discrimination Gap | 7.5% | >15% |
| Mechanics Correlation | 0.898 | ✅ |
| Narrative Correlation | 0.405 | Needs work |
| Aesthetic Correlation | 0.220 | ❌ |
| Atmosphere Correlation | 0.172 | ❌ |

## Interpretation

- **Mechanics facet works well** - tag-based templates capture gameplay similarity
- **Aesthetic/Atmosphere facets are weak** - image embeddings don't capture visual similarity
- **The system is carried by mechanics alone**

## Improving the Model

1. **Fix aesthetic embeddings** - Current SigLIP model may not be ideal for game screenshots. Consider DINOv2.
2. **Fix atmosphere embeddings** - Currently just reuses aesthetic + mood tags. Needs dedicated approach.
3. **Expand ground truth** - More test pairs = more confidence in metrics.

## Adding New Test Pairs

Edit `scripts/ground-truth-realistic.json`:

```json
{
  "category_name": [
    {
      "source": 12345,
      "target": 67890,
      "source_title": "Game A",
      "target_title": "Game B", 
      "expected_similarity": "high",
      "reason": "Why these should be similar"
    }
  ]
}
```

Then run backfill to ensure both games have embeddings.
