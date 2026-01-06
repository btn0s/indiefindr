# IndieFindr

Discover your next favorite indie game through AI-powered recommendations. IndieFindr analyzes game screenshots and generates intelligent suggestions, helping you find hidden gems beyond the Steam storefront.

## What is IndieFindr?

IndieFindr solves a real problem: **discovering great indie games is hard**. The Steam storefront is dominated by AAA titles and popular releases, making it difficult to find the indie games that match your taste. 

IndieFindr uses multimodal AI to understand what makes games similar—not just genres or tags, but visual style, gameplay feel, and overall vibe. When you find a game you love, IndieFindr shows you similar games with explanations, helping you discover your next obsession.

### Why Indie Games?

Indie games often offer unique experiences, innovative mechanics, and creative storytelling that you won't find in mainstream releases. But they're harder to discover because they lack the marketing budgets and storefront visibility of AAA titles. IndieFindr prioritizes indie games in its recommendations, surfacing lesser-known titles that deserve attention.

## Key Features

- **AI-Powered Discovery**: Get 8-12 game suggestions with explanations of why each game is similar
- **Visual Understanding**: Analyzes game screenshots to understand art style, atmosphere, and gameplay feel
- **Indie-First**: Prioritizes indie games and lesser-known titles over mainstream releases
- **Smart Recommendations**: Each suggestion includes an explanation, not just a title
- **Curated Collections**: Browse hand-picked collections of games organized by theme or style
- **Search**: Find games in your collection or search Steam directly

## How It Works

1. **Add a Game**: Paste any Steam store URL to add it to your collection
2. **Get Recommendations**: IndieFindr analyzes the game and generates similar indie game suggestions
3. **Explore**: Each suggestion includes an explanation of why it's similar—art style, gameplay mechanics, atmosphere, or overall vibe
4. **Discover**: Click through to find your next favorite game

The AI looks at what makes games similar beyond surface-level tags. It understands visual style, camera perspective, combat feel, pacing, and tone—the things that actually matter when you're looking for your next game.

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

5. **Run the development server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

### Adding Games

Paste any Steam store URL on the home page. The game will be added to your collection, and IndieFindr will automatically generate recommendations.

### Exploring Recommendations

Click on any game to see its detail page with AI-generated similar games. Each suggestion includes an explanation of why it's similar. Use the refresh button to get new recommendations.

### Collections

Collections let you organize games by theme, style, or any other criteria. Create collections in the Supabase dashboard and pin them to the home page or specific game pages.

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: Supabase (PostgreSQL)
- **AI**: Perplexity Sonar Pro via AI SDK
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Type Safety**: TypeScript

### How Recommendations Work

IndieFindr uses multimodal AI to analyze games:

1. **Input**: Game screenshot + text context (title, description, tags)
2. **Analysis**: AI model identifies visual style, gameplay feel, atmosphere, and tone
3. **Matching**: Finds similar games based on these deeper characteristics
4. **Filtering**: Prioritizes indie games and validates against Steam database
5. **Explanation**: Generates a brief explanation for each recommendation

The system prioritizes indie games because they often offer unique experiences that are harder to discover through traditional storefront browsing.

### Database

Games are stored in Supabase with their Steam metadata, screenshots, videos, and AI-generated suggestions. Suggestions are stored as JSONB arrays with explanations, making it easy to display and update recommendations.

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

### GET `/api/games/[appid]/suggestions`

Get AI-generated suggestions for a game.

**Response:**
```json
{
  "appid": 123456,
  "title": "Game Name",
  "suggestions": [
    {
      "appId": 789012,
      "title": "Similar Game",
      "explanation": "Shares the same atmospheric pixel art style and exploration-focused gameplay"
    }
  ],
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### POST `/api/games/[appid]/suggestions/refresh`

Regenerate suggestions for a game.

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

## Project Structure

```
indiefindr/
├── src/
│   ├── app/              # Next.js app router pages and API routes
│   ├── components/       # React components
│   ├── lib/             # Core logic (ingestion, AI suggestions, Steam API)
│   └── hooks/           # React hooks
├── supabase/migrations/ # Database migrations
└── scripts/             # Utility scripts
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
- AI recommendations via [Perplexity](https://www.perplexity.ai/)
