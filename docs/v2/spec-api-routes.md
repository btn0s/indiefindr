# API Routes

## Overview

V2 endpoints live under `/api/v2/` to isolate from v1.

## Endpoints

### `POST /api/v2/embed`

Generate embeddings for a single game.

**Request:**
```json
{
  "appid": 1234567
}
```

**Response:**
```json
{
  "appid": 1234567,
  "embeddings": {
    "tags": true,
    "vibe": true,
    "mechanics": true,
    "visual": false
  },
  "profile": {
    "type": "gameplay",
    "confidence": 0.72
  },
  "timing": {
    "total_ms": 450,
    "tags_ms": 150,
    "vibe_ms": 140,
    "mechanics_ms": 160
  }
}
```

**Errors:**
- `404`: Game not found in `games_new`
- `400`: Game has no embeddable content (no tags, no description)

---

### `GET /api/v2/similar/[appid]`

Find similar games using embedding search.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 10 | Max results (1-50) |
| `preference` | string | 'auto' | Weight preset: 'auto', 'visual', 'gameplay', 'vibe', 'similar-tags' |
| `debug` | boolean | false | Include rank debug info |

**Request:**
```
GET /api/v2/similar/1234567?limit=10&preference=auto&debug=true
```

**Response:**
```json
{
  "source": {
    "appid": 1234567,
    "title": "Hades",
    "profile": {
      "type": "gameplay",
      "confidence": 0.72
    }
  },
  "suggestions": [
    {
      "appid": 2345678,
      "title": "Dead Cells",
      "header_image": "https://...",
      "score": 0.0234,
      "matchedFacets": ["tags", "mechanics", "vibe"],
      "debug": {
        "tags_rank": 2,
        "vibe_rank": 8,
        "mechanics_rank": 1,
        "visual_rank": null
      }
    }
  ],
  "weights": {
    "tags": 0.35,
    "vibe": 0.15,
    "mechanics": 0.40,
    "visual": 0.10
  },
  "timing": {
    "total_ms": 42
  }
}
```

**Errors:**
- `404`: Game not found or has no embeddings
- `400`: Invalid parameters

---

### `POST /api/v2/batch-embed`

Generate embeddings for multiple games (backfill).

**Request:**
```json
{
  "appids": [1234567, 2345678, 3456789],
  "skip_existing": true
}
```

**Response:**
```json
{
  "processed": 2,
  "skipped": 1,
  "failed": [],
  "timing_ms": 890
}
```

**Notes:**
- Rate limited to prevent API abuse
- Processes sequentially to respect OpenAI rate limits
- Use for backfill script, not real-time

---

### `POST /api/v2/compare` (Debug)

Compare two games across all facets.

**Request:**
```json
{
  "appid_a": 1234567,
  "appid_b": 2345678
}
```

**Response:**
```json
{
  "game_a": { "appid": 1234567, "title": "Hades" },
  "game_b": { "appid": 2345678, "title": "Dead Cells" },
  "similarity": {
    "tags": 0.89,
    "vibe": 0.72,
    "mechanics": 0.91,
    "visual": null
  },
  "combined_rrf": 0.0234
}
```

## Implementation

### Route Handler Pattern

```typescript
// src/app/api/v2/similar/[appid]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { findSimilarGames } from '@/lib/v2/similarity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  const { appid } = await params;
  const appidNum = parseInt(appid, 10);
  
  if (isNaN(appidNum)) {
    return NextResponse.json({ error: 'Invalid appid' }, { status: 400 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const preference = searchParams.get('preference') || 'auto';
  const debug = searchParams.get('debug') === 'true';
  
  try {
    const result = await findSimilarGames(appidNum, { limit, preference, debug });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
```

### Error Handling

All v2 routes return consistent error format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

Error codes:
- `GAME_NOT_FOUND`: Game doesn't exist in database
- `NO_EMBEDDINGS`: Game exists but has no embeddings
- `INVALID_PARAMS`: Bad request parameters
- `RATE_LIMITED`: Too many requests
