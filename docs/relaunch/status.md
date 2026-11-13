# Relaunch checkpoint — 2026-11-13

Phase 1 preview: https://games-graph-jp1eb7p44-thinkhumanco.vercel.app

Supabase project `rqcqlpoxtdddjcylhopk` (`indiefindr-relaunch`, us-west-2) is now on the approved Pro organization with Micro compute and 8 GB disk. Publication checks a 7.2 GB operating budget; paid plans do not bypass capacity checks.

Loaded 25,555 games, 446 tags, and 327,809 recommendation rows. 18,785 games meet the settled indie rule. Major publisher names are normalized before matching. The merged model's saved score-ordered top-200 candidates are filtered with the indie mask before selecting ten. All 25,555 games now have exactly ten distinct indie model recommendations (255,550 model rows), and all 8,648 LLM source slates remain preserved (72,259 rows). Database assertions confirm zero missing model pages and zero non-indie targets. The original 786 empty model slates are fixed. Saved candidate SHA-256: `28d0d87e5eb1ef16702cf1a0f799eeb5e17bd11e5d0d7e10f0a3dce7252684cc`.

The app reads stored lists only, preferring LLM whenever present. Missing games return 404, without Steam fetching or database inserts. Search uses the loaded catalog. Retired collection/trainer routes, submit route, locks, rate limits, and generation code are archived outside the application. Migration history is preserved outside the active migrations directory; the fresh project has one migration. Raw Steam payloads remain outside the database.

Collection exports are in ignored `data/archive/`: five collections, 42 membership rows. The archive was queried within explicit read-only transactions. No matching trainer/BPR tables were present to export. All new database writes are guarded to the new project. Original main checkout WIP was not edited.

Tracking: visible-card impressions, card clicks, Steam clicks, tab session UUID, referrer, recommendation positions. The events table is not publicly writable/readable; same-origin validated events are inserted through a server route. Steam outbound links include UTM parameters. Events are operational analytics, not a payment ledger; bot-resistant attribution and retention still need future work.

SEO: canonical game pages, VideoGame and breadcrumb structured data, llms.txt, sitemap index plus paginated shards. Requests never generate recommendations. Numeric appid routes remain canonical to preserve existing links.

Validation: production build and TypeScript pass; ESLint has zero errors (one existing warning). Deployed game page and final sitemap shard returned HTTP 200 through Vercel CLI authenticated curl. Local functional checks passed for home, Stardew Valley, Elden Ring, catalog search, and a test event insertion. Initial Next metadata sitemap returned 404; replaced with explicit sitemap index/shard routes.

## Remaining authorized work

- Expand the source catalog to the full Steam set; copy the offline merged model pipeline and encoder, enrich through Steam's public batch API, rerank with indie eligibility before top-ten selection, and load the new project.
- Install the native nightly offline ingest on devbox (MPS encoding); no request-time inference or LLM calls.
- Add disabled-by-default ad slots and approved affiliate deep links after account details are available.
- Obtain bt's preview approval before any production promotion. Production has not been changed.

## Accounts bt must create or apply for

1. [Fanatical affiliates](https://www.fanatical.com/en/affiliates): website affiliate application through Awin. The current official page says free to join. Supply approved tracking/deep-link details after acceptance.
2. [Green Man Gaming affiliates](https://www.greenmangaming.com/affiliates): select Business Affiliate Program for a website; the official page links to Impact. Supply approved tracking/deep-link details after acceptance.
3. [Humble Partner](https://www.humblebundle.com/partner): current public endpoint could not be verified during research. Reports indicate migration to Impact; confirm the current Humble advertiser inside the [Impact partner marketplace](https://app.impact.com/) before applying. Do not assume legacy `partner=` links or historic commission rates work.
4. [Google AdSense](https://adsense.google.com/start/): submit indiefindr.gg after the production site is restored; account/site approval and publisher/slot IDs are required. Ads remain off until approved.

Steam UTM links need no affiliate signup and do not pay commission; they provide publisher-side attribution ([Steamworks documentation](https://partner.steamgames.com/doc/marketing/utm_analytics)). Affiliate acceptance and earnings are not guaranteed. No signups were submitted on bt's behalf.

## Rebuild current-catalog model slates

The saved top-200 array is copied into ignored `data/relaunch-source/` and indexed by the appid-sorted catalog. `indie-slates.py` preserves the saved merged LambdaRank ordering and applies eligibility before taking ten. `replace-model-recs.py` atomically replaces model rows per source batch, preserving LLM rows. It refuses writes to any other project and asserts coverage after loading. No model fitting or encoder inference is needed for this step.

## Page navigation fix

The original preview rendered game pages dynamically, queried the seed separately for metadata and content, fetched recommendation IDs and cards sequentially, and explicitly disabled card-link prefetching. Game pages now use ISR (one hour), prerender the most-reviewed 100 sources during build, and prefetch full routes from visible cards. Metadata and page content share a React-cached catalog lookup. Recommendation cards use a single PostgREST relationship join. Server functions use `pdx1`, alongside the database's Oregon region. Developer pages also cache their output and reuse already-fetched card fields.

Vercel's build confirms 100 prerendered game paths. An authenticated deployed request to Stardew Valley returned `x-nextjs-prerender: 1`, `x-vercel-cache: PRERENDER`, and complete recommendation HTML. These are cache correctness checks, not latency benchmarks. First visits to uncached long-tail pages still need a render; subsequent visits use the static page cache. Search and event ingestion remain server operations.

## Full expansion — 2026-11-13

The source contains **200,896 games**, including preserved legacy pages. The approximately 122k handoff number is obsolete. Heavy compute runs only on devbox (`host_57uprbbbx5`, `/Users/bot/dev/indiefindr-relaunch`), with normalized source `data/full-source` and artifacts `data/full-model`.

The existing scorer remains running without restart. Its candidate retrieval applies the shared indie mask before LambdaRank top-ten selection. `finish-expansion.py` waits for the atomically completed slate file, then resumes the lock-protected ingest at prepare/publish, enriches all catalog media, publishes search, and installs the native 03:15 launchd job only after success. Its log is `data/finish-expansion.log`; the durable stage manifest is `data/active-run.json`.

The live capacity check confirms Pro: 151,975,603 current database bytes and a conservative expanded projection of 989,807,686 bytes, below the 7,200,000,000-byte operating budget. Media caches now use requested app IDs instead of unstable batch offsets. Search automatically trims to games with reviews only if its complete gzip size exceeds 3 MB. Publication preserves existing LLM slates when no incoming archived slate exists and verifies ten model rows per game and zero non-indie targets.

Publication, media counts, search size, and launchd installation are pending scorer completion. No `src/` edits or Vercel deployment are part of this work.
