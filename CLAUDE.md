# IndieFindr

Indie game discovery platform powered by AI recommendations. Built with Next.js 16, Supabase, and Vercel AI SDK.

## Commands

```bash
pnpm dev              # Start Supabase + Next.js dev server (localhost:3000)
pnpm build            # Production build (runs OG image gen via prebuild)
pnpm lint             # ESLint
pnpm supabase:types   # Regenerate DB types -> src/lib/supabase/database.types.ts
pnpm supabase:reset   # Reset local DB and reapply migrations + seed
pnpm supabase:status  # Check local Supabase services
```

## Architecture

**Next.js 16 App Router** -- RSC by default, `"use client"` only where needed.

```
src/
  app/                    # App Router
    page.tsx              # Home (collections + game grid)
    games/[appid]/        # Game detail page
    collections/[slug]/   # Collection page
    developer/[name]/     # Developer page
    api/games/submit/     # Game ingestion endpoint (rate-limited)
    api/games/search/     # Search (DB + Steam fallback)
    api/games/[appid]/    # Single game fetch
  components/             # Feature + UI components
    ui/                   # shadcn/ui primitives (base-mira theme)
  lib/
    suggest.ts            # Multi-strategy AI recommendation engine
    ingest.ts             # Steam data ingestion pipeline
    steam.ts              # Steam Store API client
    collections.ts        # Collection queries
    config.ts             # All magic numbers and timing constants
    actions/              # Server actions (games.ts, suggestions.ts)
    supabase/             # DB clients (server.ts, client.ts, service.ts) + types
  middleware.ts           # Rate limiting for /api/games/submit (60 req/min/IP)
supabase/
  migrations/             # 30+ SQL migrations (source of truth for schema)
  config.toml             # Local Supabase config
  seed.sql                # Seed data
scripts/                  # OG image gen, data ingest, env sync
```

## Key Patterns

- **Supabase, not an ORM** -- all DB access via `@supabase/supabase-js`. Three clients: `server.ts` (anon, cookie-based), `client.ts` (browser), `service.ts` (service role, bypasses RLS).
- **Config-driven tuning** -- all retry/polling/rate-limit constants live in `src/lib/config.ts`. Change behavior there, not inline.
- **Distributed locking** -- ingestion uses DB-level locks (`LOCK_EXPIRY_SECONDS`) to prevent duplicate concurrent ingests of the same game.
- **AI suggestions** -- `suggest.ts` calls OpenAI/Perplexity models via Vercel AI SDK (`ai` package) with structured Zod schemas. Results stored in `game_suggestions` table.
- **Evaluating recommendations** -- `docs/recommendation-evaluation-framework.md` describes the eval stack (human pairwise, offline scorecard, stress tests, future logging/OPE) from current `games like X` toward taste-brief / agent-assisted matching. Cited external work is summarized in `docs/research/` (stable IDs, limits, takeaways).
- **SSE streaming** -- submit endpoint streams ingestion progress to clients.
- **Redirects** -- legacy routes (`/find/:id`, `/:id/:slug`, `/user/:username`) redirected in `next.config.ts`.

## Database

**Primary tables:** `games_new`, `game_suggestions`, `collections`, `collection_games`, `collection_pins`.

Types are manually defined in `src/lib/supabase/types.ts` (`GameNew`, `Collection`, `Suggestion`). Generated types from `pnpm supabase:types` go to `src/lib/supabase/database.types.ts`.

Migrations are the schema source of truth -- always add new migrations under `supabase/migrations/`.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16.1 (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Supabase |
| UI | shadcn/ui (base-mira) + Base UI + Lucide icons |
| Styling | Tailwind CSS v4 (CSS-driven, no tailwind.config) |
| AI | Vercel AI SDK (`ai`) with OpenAI + Perplexity |
| Validation | Zod |
| Package manager | pnpm |

## Environment Variables

Supabase vars are auto-synced for local dev via `pnpm dev` (starts Supabase). For production:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` -- service role (server-only)
- `OPENAI_API_KEY` -- suggestion generation
- `PERPLEXITY_API_KEY` -- suggestion generation
- `NEXT_PUBLIC_SITE_URL` -- canonical URL for metadata/OG

## Code Style

- TypeScript strict, no `any` casts
- Prefer RSC; `"use client"` only when necessary
- Tailwind v4 built-in values; compose small components
- No unnecessary `useEffect`, `try/catch`, or abstractions
- Imports at top of file, no inline imports
- `next/font`, `next/image`, `next/script` where applicable

## External Packages in Next Config

`steam-user`, `@doctormckay/steam-crypto`, `@tobilu/qmd`, `better-sqlite3`, `node-llama-cpp` are externalized via `serverExternalPackages` to avoid bundling issues.

## No Test Suite

There is no test framework configured. Verification is `pnpm build` + `pnpm lint`.
