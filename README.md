# IndieFindr

Discover your next favorite indie game through AI-powered recommendations. IndieFindr analyzes game descriptions and generates intelligent suggestions, helping you find hidden gems beyond the Steam storefront.

## What is IndieFindr?

IndieFindr solves a real problem: **discovering great indie games is hard**. The Steam storefront is dominated by AAA titles and popular releases, making it difficult to find the indie games that match your taste. 

IndieFindr uses an adaptive AI system to understand what makes games similar—not just genres or tags, but emotional tone, gameplay feel, and overall vibe. When you find a game you love, IndieFindr shows you similar games with explanations, helping you discover your next obsession.

### Why Indie Games?

Indie games often offer unique experiences, innovative mechanics, and creative storytelling that you won't find in mainstream releases. But they're harder to discover because they lack the marketing budgets and storefront visibility of AAA titles. IndieFindr prioritizes indie games in its recommendations, surfacing lesser-known titles that deserve attention.

## Key Features

- **Adaptive AI Discovery**: Detects game type (action, narrative, cozy, avant-garde, etc.) and adjusts matching strategy accordingly
- **Tone-Aware Matching**: Understands emotional tone, not just keywords—"gigantic crustacean with cannons" matches whimsical adventures, not shooters
- **Multi-Strategy Consensus**: Runs parallel search strategies and uses consensus detection for higher quality suggestions
- **Indie-First**: Prioritizes indie games and lesser-known titles over mainstream releases
- **Smart Recommendations**: Each suggestion includes an explanation, not just a title
- **Curated Collections**: Browse hand-picked collections of games organized by theme or style
- **Search**: Find games in your collection or search Steam directly

## How It Works

1. **Add a Game**: Paste any Steam store URL to add it to your collection
2. **Type Detection**: AI analyzes the game's description to detect its type (action, narrative, cozy, avant-garde, etc.)
3. **Multi-Strategy Search**: Runs three parallel search strategies (vibe, mechanics, community) with type-aware prompts
4. **Consensus & Validation**: Combines results, weights by consensus, and validates against Steam
5. **AI Curation**: Final AI pass ranks and curates the top suggestions
6. **Discover**: Each suggestion includes an explanation of why it's similar

The AI looks at what makes games similar beyond surface-level tags. It understands emotional tone, pacing, atmosphere, and the things that actually matter when you're looking for your next game.

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- A Supabase project
- AI SDK provider/gateway configured for `perplexity/sonar` and `openai/gpt-4o-mini`

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
# Configure your AI gateway/provider to resolve perplexity/sonar and openai/gpt-4o-mini
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

5. **Run the development server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: Supabase (PostgreSQL)
- **AI**: Perplexity Sonar + OpenAI GPT-4o-mini via AI SDK
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Type Safety**: TypeScript

### How Recommendations Work

IndieFindr uses an adaptive multi-strategy AI system:

1. **Type Detection**: Analyzes game description to classify type (action, narrative, cozy, avant-garde, competitive, mainstream)
2. **Weight Assignment**: Each type gets different weights for vibe, aesthetic, theme, and mechanics matching
3. **Parallel Strategies**: Runs three search strategies simultaneously:
   - Vibe-focused (emotional tone, atmosphere)
   - Mechanics-focused (gameplay systems, core loop)
   - Community-focused (what fans recommend)
4. **Consensus Detection**: Games appearing in multiple strategies are weighted higher
5. **Validation**: Validates all suggestions against Steam database
6. **AI Curation**: Final ranking pass with type-aware curation

This approach handles edge cases better than single-prompt systems. For example:
- "Gigantic crustacean with cannons" → whimsical adventures (not shooters)
- "Guns-blazing, tactical" → action FPS (not narrative games)
- Art games from known developers → experimental/avant-garde matches

See [docs/case-study-suggestion-system.md](docs/case-study-suggestion-system.md) for a detailed case study of the recommendation system development.

### Database

Games are stored in Supabase with their Steam metadata, screenshots, videos, and AI-generated suggestions. Suggestions are stored in a dedicated `game_suggestions` table with source game, suggested game, and explanation.

## API Reference

### POST `/api/games/submit`

Submit a Steam URL to add a game to your collection.

**Request:**
```json
{
  "steamUrl": "https://store.steampowered.com/app/123456/GameName/"
}
```

### GET `/api/games/[appid]`

Get game details by Steam AppID.

### GET `/api/games/search?q=query`

Search games in your collection or Steam store.

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

### Experiments

The `scripts/experiments-v2/` directory contains test scripts for comparing different suggestion approaches:

```bash
# Run all experiments
npx tsx scripts/experiments-v2/run-all.ts
```

## Project Structure

```
games-graph/
├── src/
│   ├── app/              # Next.js app router pages and API routes
│   ├── components/       # React components
│   ├── lib/              # Core logic
│   │   ├── suggest-new.ts    # Adaptive suggestion system
│   │   ├── actions/          # Server actions
│   │   ├── supabase/         # Database clients
│   │   └── utils/            # Utilities
│   └── hooks/            # React hooks
├── scripts/
│   ├── experiments-v2/   # Suggestion approach experiments
│   └── vibe-experiments/ # Earlier experiments
├── supabase/migrations/  # Database migrations
└── docs/                 # Documentation
```

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
- AI recommendations via [Perplexity](https://www.perplexity.ai/) and [OpenAI](https://openai.com/)
