# Games Graph MVP

A Next.js application that ingests Steam games and uses an AI model (configured as `perplexity/sonar-pro`) to generate “games like this” recommendations from a game’s first screenshot plus text context.

## Features

- **Steam Game Ingestion**: Paste a Steam URL to ingest game data, screenshots, videos, and metadata
- **AI-Powered Recommendations**: Calls `suggestGames()` (`src/lib/suggest.ts`) to generate suggested similar games + short explanations
- **Game Discovery**: Browse all games and explore AI-generated recommendations for each game
- **Interactive UI**: Home page with game grid and detail pages showing recommendations with explanations
- **Auto-hydration of missing suggestions**: Missing suggested games can be ingested (Steam data only) so cards can render without triggering more suggestion generation

## Architecture

### Database (Supabase)
- **Primary table**: `games_new` stores Steam game data (screenshots, videos, descriptions, raw Steam payload)
- **Suggestions storage**: `games_new.suggested_game_appids` stores an array of objects: `{ appId, title, explanation }`
- **Legacy**: a `games` table may still exist; `GET /api/games/[appid]` falls back to it if the game isn’t found in `games_new`

### AI Integration
- **Model id**: `perplexity/sonar-pro` (see `SONAR_MODEL` in `src/lib/suggest.ts`)
- **Prompt shape**: the app sends a multimodal message containing text + an image URL/data URL. Whether the image is actually used depends on how your AI provider/gateway handles `perplexity/sonar-pro`.
- **Post-processing**: the raw model output is parsed as `title, steam_appid, explanation` lines and then validated/corrected against Steam (title/appid validation + title search) before saving.

### Ingestion Pipeline
1. Parse Steam URL → Extract AppID
2. Fetch Steam data (store page, screenshots, videos, descriptions)
3. Save to `games_new` table
4. Generate suggestions in the background (unless `skipSuggestions=true`)
5. Store merged suggestions on the game row (`games_new.suggested_game_appids`)
6. Optionally ingest missing suggested games (Steam data only) to populate UI cards without cascading suggestion generation

## Setup

### Prerequisites
- Node.js 18+ and pnpm
- Supabase project
- An AI SDK provider/gateway configured to resolve the model id `perplexity/sonar-pro`

### Environment Variables

Create a `.env.local` file with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI provider configuration
# This repo references the model id `perplexity/sonar-pro`. Configure your AI provider/gateway accordingly.
# If you're using an AI Gateway, set its base URL/key here:
AI_GATEWAY_BASE_URL=https://your-ai-gateway-url.com
AI_GATEWAY_API_KEY=your_ai_gateway_api_key

# Site URL (for SEO)
NEXT_PUBLIC_SITE_URL=https://your-site-url.com
```

### Database Setup

1. **Apply Migrations**: Run the Supabase migrations to create tables:

```bash
# Using Supabase CLI
supabase db push

# Or manually apply migration files in order:
# supabase/migrations/
```

Key migrations:
- `20250106000000_create_games_new_table.sql` - Primary `games_new` table
- `20250107000000_move_suggestions_to_games_new.sql` - Moves suggestion data onto `games_new` and drops the old `suggestions` table
- `20250111000000_add_suggestion_explanations.sql` - Documents the JSON shape for `suggested_game_appids`

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
2. **View Games**: See a grid of all ingested games sorted by number of suggestions
3. **Explore Recommendations**: Click on a game to see AI-generated similar games with explanations
4. **Refresh Suggestions**: Use the refresh button to regenerate suggestions for a game

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── games/
│   │       ├── submit/route.ts              # POST /api/games/submit
│   │       ├── search/route.ts              # GET /api/games/search
│   │       ├── batch/route.ts               # POST /api/games/batch
│   │       └── [appid]/
│   │           ├── route.ts                 # GET /api/games/[appid]
│   │           └── suggestions/
│   │               ├── route.ts              # GET /api/games/[appid]/suggestions
│   │               └── refresh/route.ts      # POST /api/games/[appid]/suggestions/refresh
│   ├── games/
│   │   └── [appid]/
│   │       ├── page.tsx                     # Game detail page
│   │       ├── opengraph-image.tsx          # OG image generation
│   │       └── twitter-image.tsx             # Twitter card image
│   └── page.tsx                              # Home page
├── lib/
│   ├── ingest.ts                             # Game ingestion pipeline
│   ├── suggest.ts                            # Perplexity AI suggestions
│   ├── steam.ts                              # Steam API integration
│   └── supabase/
│       ├── client.ts                         # Supabase clients
│       ├── server.ts                         # Server-side Supabase
│       └── types.ts                          # TypeScript types
└── components/
    ├── GameCard.tsx                          # Game card component
    ├── GamesGrid.tsx                         # Infinite scroll grid
    ├── SuggestionsList.tsx                   # Recommendations list
    └── ui/                                   # UI components (shadcn)
```

## API Routes

### POST `/api/games/submit`
Submit a Steam URL for ingestion.

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
  "steamData": { },
  "suggestions": { "suggestions": [] }
}
```

**Optional request fields:**
- `skipSuggestions: boolean` - if `true`, only fetch/save Steam data (no AI call)

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
Get game details by AppID. Reads `games_new` first, then falls back to legacy `games`.

### GET `/api/games/[appid]/suggestions`
Get AI-generated game suggestions for a game.

**Response:**
```json
{
  "appid": 123456,
  "title": "Game Name",
  "suggestions": [],
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### POST `/api/games/[appid]/suggestions/refresh`
Refresh suggestions for a game. Supports `?force=true` (dev-only) to clear existing suggestions first.

**Response (shape):**
- `suggestions`: merged suggestions array
- `newCount`: count returned by the latest model call
- `totalCount`: merged total
- `missingCount` / `missingAppIds`: suggested games not yet present in `games_new`

### POST `/api/games/batch`
Fetch multiple games by appid list (from `games_new`).

## Notes

- Suggestions are generated asynchronously after ingestion (unless `skipSuggestions=true`)
- The suggestion prompt includes an image + text; image usage depends on your model/provider handling
- Suggestions include an `explanation` string and are validated/corrected against Steam app IDs
- The home page sorts games by number of stored suggestions (then by `created_at`)
- Detail pages include OpenGraph/Twitter images and JSON-LD for SEO

## Next Steps

- Add graph visualization of game relationships
- Implement user preferences and personalized recommendations
- Add filtering and sorting options
- Enhance UI with more game metadata and screenshots
- Add batch ingestion capabilities
