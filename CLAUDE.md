# IndieFindr

Indie game discovery at www.indiefindr.gg: for any Steam game, a precomputed slate of indie games like it. Next.js 16
(Cache Components) serves a Supabase catalog that an offline pipeline publishes nightly. No model or LLM runs on a
request.

## Commands

```bash
pnpm dev                 # next dev
pnpm build               # prebuild bundles the MCP app HTML and the home OG image first
pnpm lint
npx tsc --noEmit
pnpm vitest run          # tests/**/*.test.tsx, jsdom
pnpm supabase:types      # regenerate src/lib/supabase/database.types.ts
```

`.env.local` and `.vercel/` are gitignored; in a fresh worktree, copy them from `/Users/btnorris/dev/indiefindr/`.
`.env.local` points at a local Supabase with no catalog. To develop against the real data, run
`vercel env pull .env.production.local --environment=production`, then `set -a; source .env.production.local; set +a`
before `pnpm dev`. Never print env values.

## Architecture

Routes (`src/app`):

- `/`: intro, showcase, shelves, and Browse all, which loads further pages from `GET /api/browse` as you scroll.
- `/games/[appid]`: cover (`GameTrailer`), screenshots (`ScreenshotStrip`, `ScreenshotViewer`), facts, More from the
  developer, then the recommendation slate.
- `/discover/[shelf]`: list pages; the shelves are `SHELVES` in `src/lib/catalog.ts` (rising, early-access, upcoming,
  hidden-gems, new).
- `/developer/[name]`, `/agents` (agent access docs), `/privacy`, sitemaps, `ads.txt`.
- API: `browse`, `games/search`, `games/[appid]`, `recs/[appid]`, `events` (impressions and clicks), plus the agent routes below.

**Data reads** all live in `src/lib/catalog.ts`, each one `"use cache"` + `cacheLife("hours")`. Add new reads there in
the same shape. Pages are prerendered shells over these cached reads.

**Prefetch** (comments in `next.config.ts`): every game card is a `CardLink` with `prefetch={true}`, so the whole game page
is ready before the tap. The cover image isn't in the prefetch, so `src/lib/intent.ts` warms it when the visitor is about
to open a card. `preloadHero` must ask for exactly the files `GameTrailer` renders (`smallCopy` and the optimizer
`srcset`, `src/lib/hero.ts`). Other links prefetch the static shell. The router keeps recent routes mounted, so
back/forward restores a page as it was left, Browse all's loaded pages and scroll included.

**Search**: the header search downloads a several-MB title index (Supabase storage `search/titles.json`, published
nightly) into `public/search-worker.js` the first time someone types. Matching runs in the worker, and visible rows
fetch their details from Supabase (`src/lib/use-game-search.ts`).

**Review quality**: `src/lib/review-quality.ts` reads `clean_score` and `bomb_windows`, which
`scripts/relaunch/review_quality.py` computes (docs/review-bomb-detection.md). The Steam rating always stays visible; a
rescued game adds "Review bombed".

**Agents**, all reading `src/lib/agent-catalog.ts`:

- `/mcp`: MCP server with `search_games`, `get_game` and `get_recommendations`. The latter renders an MCP App carousel
  from `src/mcp-app/`, bundled into `src/lib/mcp-app-html.ts` by prebuild.
- `/api/agent-search`, `/api/agent-game/[appid]`: the same reads as JSON.
- `src/components/WebMCP.tsx`: the same tools registered in the browser through `modelContext`.
- `packages/cli`: `npx indiefindr`. Also `public/llms.txt`.

## Data pipeline

`scripts/relaunch` (Python; its environment is set up in `scripts/recommender/README.md`) acquires Steam metadata,
encodes, ranks offline, selects 24-target slates (`selection.py`) and publishes to the Supabase project
`rqcqlpoxtdddjcylhopk`, then media and the search index. It runs nightly at 03:15 on the devbox Mac through a
LaunchAgent. The job runs a snapshot of `scripts/` pinned by content hash under `data/nightly/releases/`, so a change
to `scripts/` reaches the nightly run only after `scripts/relaunch/install-nightly.py` is re-run. Details:
`docs/relaunch/offline-ingest.md`.

`supabase/migrations` is the schema source of truth. Vercel previews read the production Supabase, so a preview shows
a migration only once it is applied there.

## Styling and motion

`src/app/globals.css` owns the look: palette, type scale, semantic classes. Its **Type roles** block is the only place
that sets font size, leading, weight, tracking or wrapping; give new text one of those roles. Tailwind v4 utilities are
for layout. Motion values come from the tokens in `globals.css` (durations, `--ease-*`, `--spring-*` springs sampled as
`linear()`), explained in `MOTION.md`. Animate transform and opacity so motion stays on the compositor. `AUDIT.md` is
the craft audit behind the current details.

Copy: separate items with spacing or commas, never a middle dot (`·`).

## Code

TypeScript strict, no `any`. Server components by default; `"use client"` only where the browser is needed. Imports
at the top of the file.

## Ship

1. `pnpm build`, `npx tsc --noEmit`, `pnpm lint`, `pnpm vitest run`.
2. Load home, a game page (`/games/367520`) and a list page (`/discover/rising`) at 1280px and at 393px (iPhone).
   On each, assert `document.documentElement.scrollWidth === innerWidth`, and look at the phone screenshots yourself:
   a desktop-only check once shipped a phone overflow bug. playwright-core with
   `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` works.
   Previews (Vercel project `games-graph`) sit behind Vercel Authentication: `vercel curl <path> --deployment <url>`
   uses the project's bypass token. For headless Chrome, send that token as `x-vercel-protection-bypass` with
   `x-vercel-set-bypass-cookie: true`.
3. Squash-merge the PR, run `vercel deploy --prod`, then check www.indiefindr.gg on a phone.
