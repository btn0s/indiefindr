# IndieFindr

> **Note:** The repository is named `indiefindr` and the application is branded as **IndieFindr**.

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
- API keys for OpenAI and Perplexity (the app uses Vercel AI SDK with direct provider access)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/btn0s/indiefindr.git
cd indiefindr
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file with your API keys:

```env
# AI Provider Configuration
# The app uses Vercel AI SDK with direct provider access
OPENAI_API_KEY=your_openai_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key

# Site Configuration (optional)
NEXT_PUBLIC_SITE_URL=https://your-site-url.com
```

**Note**: Supabase credentials are automatically synced when you run `pnpm dev`. For local development, you don't need to set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` manually.

4. **Set up the database**

For local development:

```bash
# Start local Supabase stack
pnpm supabase:start

# Reset database (applies migrations + seed data)
pnpm supabase:reset
```

For production/preview branches, see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for detailed setup instructions.

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

# Supabase local development
pnpm supabase:start    # Start local Supabase stack
pnpm supabase:stop     # Stop local Supabase stack
pnpm supabase:status   # Check local Supabase status
pnpm supabase:reset    # Reset database (migrations + seed)
pnpm supabase:types    # Generate TypeScript types from schema
```

### Experiments

The `scripts/experiments-v2/` directory contains test scripts for comparing different suggestion approaches:

```bash
# Run all experiments
npx tsx scripts/experiments-v2/run-all.ts
```

## Project Structure

```
indiefindr/
├── src/
│   ├── app/              # Next.js app router pages and API routes
│   ├── components/       # React components
│   ├── lib/              # Core logic
│   │   ├── suggest.ts        # Adaptive suggestion system
│   │   ├── actions/          # Server actions
│   │   ├── supabase/         # Database clients
│   │   └── utils/            # Utilities
│   └── hooks/            # React hooks
├── scripts/
│   └── experiments-v2/   # Suggestion approach experiments (Test A is production)
├── archive/
│   ├── vibe-experiments/ # Historical experiments (archived)
│   └── suggestion-experiments/ # Historical experiments (archived)
├── supabase/migrations/  # Database migrations
└── docs/                 # Documentation
```

## Why Open Source?

IndieFindr is open source to:
- Help indie developers understand how game discovery can be improved
- Enable researchers to study AI-powered recommendation systems
- Let the community contribute improvements to indie game discovery
- Demonstrate practical applications of adaptive AI systems

## For Contributors

This is an active project! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.

Key areas where contributions are welcome:
- UI/UX improvements
- Performance optimizations
- Additional game data sources
- Better recommendation algorithms
- Bug fixes and documentation

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup guide
- Code style guidelines  
- How to submit changes
- Project structure explanation

For questions or discussions, open an issue on GitHub.

## License

This project is open source under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database powered by [Supabase](https://supabase.com/)
- AI recommendations via [Perplexity](https://www.perplexity.ai/) and [OpenAI](https://openai.com/)
