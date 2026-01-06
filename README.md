# IndieFindr

A Next.js application that discovers Steam games through AI-powered recommendations. Ingest games from Steam, explore AI-generated "games like this" suggestions, and discover your next favorite indie game.

## Overview

IndieFindr uses multimodal AI (Perplexity Sonar Pro) to analyze game screenshots and generate intelligent recommendations. Each suggestion includes an explanation of why the game is similar, helping you discover games that match your preferences.

### Key Features

- **Steam Game Ingestion**: Submit any Steam store URL to fetch game data, screenshots, videos, and metadata
- **AI-Powered Recommendations**: Get 8-12 similar game suggestions with explanations using image + text analysis
- **Indie-First Discovery**: Prioritizes indie games and lesser-known titles over AAA releases
- **Game Collections**: Curate and display collections of games on home and detail pages
- **Video Playback**: Watch Steam game trailers directly on detail pages
- **Smart Search**: Search both your database and Steam store simultaneously
- **Auto-Hydration**: Missing suggested games are automatically ingested (Steam data only) to populate UI cards

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: Supabase (PostgreSQL with pgvector)
- **AI**: Perplexity Sonar Pro via AI SDK
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Type Safety**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- A Supabase project
- An AI SDK provider/gateway configured for `perplexity/sonar-pro`

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/btn0s/games-graph.git
cd games-graph
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Provider Configuration
# Configure your AI gateway/provider to resolve perplexity/sonar-pro
AI_GATEWAY_BASE_URL=https://your-ai-gateway-url.com
AI_GATEWAY_API_KEY=your_ai_gateway_api_key

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://your-site-url.com
```

4. **Set up the database**

Apply migrations using the Supabase CLI:

```bash
supabase db push
```

Or manually apply migration files in order from `supabase/migrations/`.

**Key migrations:**
- `20250101000000_initial_schema.sql` - Initial games table with vector embeddings
- `20250106000000_create_games_new_table.sql` - Primary games_new table
- `20250112000000_add_collections.sql` - Collections feature
- `20260104085314_add_games_new_home_view.sql` - Performance optimizations

5. **Run the development server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

### Ingesting Games

1. Navigate to the home page
2. Paste a Steam store URL (e.g., `https://store.steampowered.com/app/123456/GameName/`)
3. The game will be fetched from Steam and saved to the database
4. AI suggestions will be generated automatically in the background

### Exploring Recommendations

1. Click on any game card to view its detail page
2. Scroll down to see AI-generated similar games
3. Each suggestion includes an explanation of why it's similar
4. Click "Refresh Suggestions" to regenerate recommendations

### Managing Collections

Collections are managed directly in the Supabase dashboard:

1. **Create a collection** in the `collections` table:
   - `slug`: URL-friendly identifier (e.g., `indie-roguelikes`)
   - `title`: Display name
   - `description`: Optional description
   - `published`: Set to `true` to make visible

2. **Add games** in `collection_games`:
   - `collection_id`: UUID from collections table
   - `appid`: Steam AppID (must exist in `games_new`)
   - `position`: Ordering number

3. **Pin collections** in `collection_pins`:
   - `context`: `'home'` for home page or `'game'` for game pages
   - `game_appid`: Required for game context, NULL for home
   - `position`: Display order

## Architecture

### Database Schema

**Primary Table: `games_new`**
- Stores Steam game data: screenshots, videos, descriptions, metadata
- `suggested_game_appids`: JSONB array of `{ appId, title, explanation }` objects
- Optimized with materialized views for home page queries

**Collections**
- `collections`: Collection metadata
- `collection_games`: Games in each collection
- `collection_pins`: Where collections appear (home/game pages)

**Performance**
- Materialized view `games_new_home` for fast home page queries
- Automatic refresh triggers on game updates
- Indexes on frequently queried columns

### AI Integration

**Model**: `perplexity/sonar-pro`

**Input**: Multimodal message containing:
- Game screenshot (first screenshot from Steam)
- Text context (game title, description, tags)

**Output**: Parsed as `title, steam_appid, explanation` lines

**Post-Processing**:
- Validates app IDs against Steam database
- Corrects titles via Steam search
- Filters and prioritizes indie games
- Merges with existing suggestions

**Indie-First Strategy**:
- Strictly prioritizes indie games (independent developers, smaller studios)
- Allows 1-2 non-indie games only if unavoidable for relevance
- Includes mix of recent (last 6 months) and classic titles

### Ingestion Pipeline

1. **Parse Steam URL** → Extract AppID
2. **Fetch Steam Data** → Store page, screenshots, videos, descriptions
3. **Save to Database** → Store in `games_new` table
4. **Generate Suggestions** → Call AI model with screenshot + context (background)
5. **Store Suggestions** → Merge into `suggested_game_appids` array
6. **Auto-Hydrate Missing Games** → Ingest suggested games (Steam data only) to populate UI

### API Routes

#### POST `/api/games/submit`

Submit a Steam URL for ingestion.

**Request:**
```json
{
  "steamUrl": "https://store.steampowered.com/app/123456/GameName/",
  "skipSuggestions": false
}
```

**Response:**
```json
{
  "success": true,
  "appid": 123456,
  "title": "Game Name",
  "steamData": { /* Steam API response */ },
  "suggestions": { "suggestions": [] }
}
```

#### GET `/api/games/[appid]`

Get game details by AppID. Reads `games_new` first, falls back to legacy `games` table.

#### GET `/api/games/search?q=query`

Search games in database and Steam Store (minimum 2 characters).

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

#### GET `/api/games/[appid]/suggestions`

Get AI-generated suggestions for a game.

**Response:**
```json
{
  "appid": 123456,
  "title": "Game Name",
  "suggestions": [
    { "appId": 789012, "title": "Similar Game", "explanation": "..." }
  ],
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

#### POST `/api/games/[appid]/suggestions/refresh`

Refresh suggestions for a game. Supports `?force=true` (dev-only) to clear existing suggestions first.

#### POST `/api/games/batch`

Fetch multiple games by AppID list (from `games_new`).

## Project Structure

```
indiefindr/
├── src/
│   ├── app/
│   │   ├── api/games/          # API routes
│   │   │   ├── submit/          # POST /api/games/submit
│   │   │   ├── search/          # GET /api/games/search
│   │   │   ├── batch/           # POST /api/games/batch
│   │   │   └── [appid]/
│   │   │       ├── route.ts     # GET /api/games/[appid]
│   │   │       └── suggestions/ # Suggestions endpoints
│   │   ├── games/[appid]/       # Game detail pages
│   │   │   ├── page.tsx
│   │   │   ├── opengraph-image.tsx
│   │   │   └── twitter-image.tsx
│   │   ├── collections/[slug]/  # Collection pages
│   │   ├── page.tsx             # Home page
│   │   ├── layout.tsx           # Root layout
│   │   ├── sitemap.ts           # Dynamic sitemap
│   │   └── robots.ts            # Robots.txt
│   ├── components/
│   │   ├── GameCard.tsx         # Game card component
│   │   ├── GamesGrid.tsx        # Infinite scroll grid
│   │   ├── SuggestionsList.tsx  # Recommendations display
│   │   ├── GameVideo.tsx        # Video playback
│   │   ├── CollectionsSection.tsx
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── ingest.ts             # Game ingestion pipeline
│   │   ├── suggest.ts            # AI suggestion generation
│   │   ├── steam.ts              # Steam API client
│   │   ├── collections.ts       # Collection queries
│   │   ├── supabase/             # Database clients and types
│   │   └── utils/                # Utility functions
│   └── hooks/
│       └── use-mobile.ts         # Mobile detection
├── supabase/migrations/         # Database migrations
├── scripts/                      # Utility scripts
│   ├── ingest-top-indie-games.ts
│   ├── ingest-suggested-games.ts
│   └── generate-home-og.ts
└── public/                       # Static assets
```

## Development

### Scripts

```bash
# Development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

### Utility Scripts

```bash
# Ingest top indie games from a list
tsx scripts/ingest-top-indie-games.ts

# Ingest all suggested games for a game
tsx scripts/ingest-suggested-games.ts <appid>

# Generate home page OG image
tsx scripts/generate-home-og.ts
```

## Performance

- **Home Page**: Uses materialized view for fast queries
- **Game Detail Pages**: Server-side rendered with caching
- **Video Playback**: HLS.js for streaming Steam trailers
- **Image Optimization**: Next.js Image component with Steam CDN domains
- **SEO**: Dynamic sitemap, robots.txt, OpenGraph images

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database powered by [Supabase](https://supabase.com/)
- AI recommendations via [Perplexity](https://www.perplexity.ai/)
