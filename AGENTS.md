# IndieFindr

For any Steam game, a slate of indie games like it, at www.indiefindr.gg. Slates are computed offline every night and
published to Supabase; nothing runs a model on a request.

## Read the code

The code, and the data and config it actually reads, is the only description of this project. Read it before you
change it, and write no description of it anywhere else: no comments, no docs, no notes beside this file. Put the
reason for a change in its commit message. `scripts/no-prose.mjs` enforces this on every commit and in `pnpm lint`.

## Where things are

- `src/app`: the Next.js 16 routes, prerendered shells over cached reads (Cache Components).
- `src/lib/catalog.ts`: every data read the site makes.
- `src/lib/agent-catalog.ts`: what agents read, through `/mcp`, the `api/agent-*` routes, `src/components/WebMCP.tsx`
  and `packages/cli`.
- `src/app/globals.css`: the whole look, including the type roles and the motion tokens.
- `next.config.ts`, `src/lib/intent.ts`, `src/lib/hero.ts`: prefetch and cover warm-up.
- `public/search-worker.js`, `src/lib/use-game-search.ts`: search.
- `scripts/relaunch`: the offline pipeline (Python) that ingests Steam, ranks, selects slates and publishes.
  `scripts/recommender` is its environment: `UV_CACHE_DIR="$PWD/data/uv-cache" uv sync --frozen --project scripts/recommender`.
- `supabase/migrations`: the schema.

## What the code can't show

- `.env.local` and `.vercel/` are gitignored; in a fresh worktree copy them from `/Users/btnorris/dev/indiefindr/`.
  `.env.local` points at an empty local Supabase. For the real catalog, run
  `vercel env pull .env.production.local --environment=production`, then `set -a; source .env.production.local; set +a`
  before `pnpm dev`. Never print env values.
- The pipeline runs nightly at 03:15 on the devbox Mac from a snapshot of `scripts/` pinned by content hash. A change
  to `scripts/` reaches it only after `scripts/relaunch/install-nightly.py` is re-run.
- Vercel previews read the production Supabase (project `rqcqlpoxtdddjcylhopk`), so a preview shows a migration only
  once it is applied there.

## Ship

1. `pnpm build`, `npx tsc --noEmit`, `pnpm lint`, `pnpm vitest run`.
2. Load `/`, `/games/367520` and `/discover/rising` at 1280px and 393px, assert
   `document.documentElement.scrollWidth === innerWidth`, and look at the phone screenshots yourself. playwright-core
   with `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` works. Previews (Vercel project
   `games-graph`) sit behind Vercel Authentication: `vercel curl <path> --deployment <url>` uses the bypass token; for
   headless Chrome send it as `x-vercel-protection-bypass` with `x-vercel-set-bypass-cookie: true`.
3. Squash-merge the PR, run `vercel deploy --prod`, then check www.indiefindr.gg on a phone.
