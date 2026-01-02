# Games Graph MVP

A Next.js application that ingests Steam games and uses AI vision models to generate similarity-based game recommendations.

## Features

- **Steam Game Ingestion**: Paste a Steam URL to ingest game data, screenshots, videos, and metadata
- **AI-Powered Recommendations**: Uses Perplexity Sonar Pro vision model to analyze game screenshots and generate similar game suggestions
- **Game Discovery**: Browse all games and explore AI-generated recommendations for each game
- **Interactive UI**: Home page with game grid and detail pages showing recommendations with explanations

## Architecture

### Database (Supabase)
- `games_new` table stores Steam game data (screenshots, videos, descriptions, metadata)
- `suggested_game_appids` JSONB column stores AI-generated game suggestions with explanations
- Simple schema focused on Steam data and recommendations

### AI Integration
- **Perplexity Sonar Pro**: Vision model for analyzing game screenshots and generating recommendations
- **AI SDK**: Uses Vercel AI SDK for model interactions
- Suggestions include explanations for why each game is similar

### Ingestion Pipeline
1. Parse Steam URL → Extract AppID
2. Fetch Steam data (store page, screenshots, videos, descriptions)
3. Save to `games_new` table
4. Generate suggestions in background using Perplexity vision model
5. Store suggestions in `suggested_game_appids` column

## Setup

### Prerequisites
- Node.js 18+ and pnpm
- Supabase project
- AI Gateway configured (for Perplexity API access)

### Environment Variables

Create a `.env.local` file with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Gateway Configuration (for Perplexity)
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
- `20250101000000_initial_schema.sql` - Initial games table (legacy)
- `20250106000000_create_games_new_table.sql` - Main games_new table
- `20250107000000_move_suggestions_to_games_new.sql` - Suggestions storage
- `20250111000000_add_suggestion_explanations.sql` - Explanation fields

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
  "title": "Game Name"
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

### GET `/api/games/[appid]/suggestions`
Get AI-generated game suggestions for a game.

**Response:**
```json
{
  "suggestions": [
    {
      "appId": 789012,
      "title": "Similar Game",
      "explanation": "Shares the same visual style and gameplay mechanics"
    }
  ]
}
```

### POST `/api/games/[appid]/suggestions/refresh`
Force regenerate suggestions for a game.

## Notes

- Suggestions are generated asynchronously in the background after initial ingestion
- The AI model analyzes game screenshots to find similar games
- Suggestions include explanations for why each game is recommended
- Games are sorted by number of suggestions on the home page
- SEO optimized with OpenGraph and Twitter card images

## Next Steps

- Add graph visualization of game relationships
- Implement user preferences and personalized recommendations
- Add filtering and sorting options
- Enhance UI with more game metadata and screenshots
- Add batch ingestion capabilities
