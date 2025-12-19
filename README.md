# Games Graph MVP

A Next.js application that ingests Steam games, extracts three facets (Aesthetics, Gameplay, Narrative/Mood) using AI vision models, generates embeddings, and provides similarity-based game recommendations.

## Features

- **Steam Game Ingestion**: Paste a Steam URL to ingest game data, screenshots, and metadata
- **AI-Powered Facet Extraction**: Uses vision models to extract three distinct facets from game screenshots
- **Vector Similarity Search**: Stores embeddings in pgvector and finds similar games by each facet
- **Interactive UI**: Home page with game list and detail pages showing facet-based recommendations

## Architecture

### Database (Supabase + pgvector)
- `games` table with three embedding columns (aesthetic, gameplay, narrative)
- `ingest_jobs` table for tracking ingestion status
- Vector indexes for efficient similarity search
- RPC function `get_related_games` for similarity queries

### AI Integration
- AI Gateway client (configured via environment variables)
- Vision model: `openai/gpt-4o-mini` for facet extraction
- Embedding model: `openai/text-embedding-3-small` (1536 dimensions)
- Model ID format: `provider/model` (e.g., `openai/gpt-4o-mini`)

### Ingestion Pipeline
1. Parse Steam URL → Extract AppID
2. Fetch Steam data (store, reviews, tags)
3. Extract facets using vision model
4. Generate embeddings for each facet
5. Upsert into database

## Setup

### Prerequisites
- Node.js 18+ and pnpm
- Supabase project with pgvector extension
- AI Gateway configured and accessible

### Environment Variables

Create a `.env.local` file with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Gateway Configuration
AI_GATEWAY_BASE_URL=https://your-ai-gateway-url.com
AI_GATEWAY_API_KEY=your_ai_gateway_api_key
```

### Database Setup

1. **Apply Migrations**: Run the Supabase migration to create tables and indexes:

```bash
# Using Supabase CLI
supabase db push

# Or manually apply the migration file:
# supabase/migrations/20250101000000_initial_schema.sql
```

The migration includes:
- pgvector extension
- `games` table with 3 embedding columns
- `ingest_jobs` table
- Vector indexes (IVFFlat with cosine distance)
- RPC function for similarity queries

### Install Dependencies

```bash
pnpm install
```

### Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

1. **Ingest a Game**: Paste a Steam URL (e.g., `https://store.steampowered.com/app/123456/GameName/`) on the home page
2. **View Games**: See a list of all ingested games
3. **Explore Similar Games**: Click on a game to see similar games by:
   - Aesthetics (visual style, art direction)
   - Gameplay (mechanics, player perspective)
   - Narrative/Mood (theme, atmosphere)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── games/
│   │       ├── submit/route.ts          # POST /api/games/submit
│   │       ├── search/route.ts          # GET /api/games/search
│   │       ├── [appid]/route.ts         # GET /api/games/[appid]
│   │       └── [appid]/related/route.ts # GET /api/games/[appid]/related
│   ├── games/
│   │   └── [appid]/page.tsx             # Game detail page
│   └── page.tsx                          # Home page
├── lib/
│   ├── ai/
│   │   ├── gateway.ts                   # AI Gateway client
│   │   └── facet-extractor.ts           # Vision facet extraction
│   ├── ingest/
│   │   └── pipeline.ts                   # Main ingestion pipeline
│   ├── steam/
│   │   ├── parser.ts                     # Steam URL parser
│   │   └── providers.ts                  # Steam API providers
│   └── supabase/
│       ├── client.ts                     # Supabase clients
│       └── types.ts                       # TypeScript types
└── components/
    └── ui/                                # UI components (shadcn)
```

## API Routes

### POST `/api/games/submit`
Submit a Steam URL for ingestion and suggestion generation.

**Request:**
```json
{
  "steamUrl": "https://store.steampowered.com/app/123456/GameName/"
}
```

**Response:**
```json
{
  "success": true,
  "appid": 123456,
  "title": "Game Name",
  "steamData": { ... },
  "suggestions": { ... }
}
```

### GET `/api/games/search?q=query`
Search for games in the database and Steam Store.

**Query Parameters:**
- `q`: Search query (minimum 2 characters)

**Response:**
```json
{
  "db": [
    { "appid": 123456, "title": "Game Name", "header_image": "...", "inDatabase": true }
  ],
  "steam": [
    { "appid": 789012, "title": "Another Game", "header_image": "...", "inDatabase": false }
  ]
}
```

### GET `/api/games/[appid]`
Get game details by AppID.

### GET `/api/games/[appid]/related?facet=all&limit=10&threshold=0.7`
Get similar games by facet(s).

**Query Parameters:**
- `facet`: `aesthetic` | `gameplay` | `narrative` | `all` (default: `all`)
- `limit`: Number of results (default: `10`)
- `threshold`: Minimum similarity score 0-1 (default: `0.7`)

## Notes

- The AI Gateway must support the `provider/model` format for model routing
- Embedding dimension is fixed at 1536 (text-embedding-3-small)
- Vector indexes use IVFFlat with cosine distance
- Similarity scores are calculated as `1 - cosine_distance`

## Next Steps

- Add graph-building capabilities
- Support additional aggregation providers (SteamSpy, etc.)
- Implement global similarity view (average of three facets)
- Add pagination and filtering
- Enhance UI with more game metadata
