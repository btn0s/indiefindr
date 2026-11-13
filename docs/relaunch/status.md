# Relaunch checkpoint — 2026-11-13

Phase 1 preview: https://games-graph-jp1eb7p44-thinkhumanco.vercel.app

Fresh Free Supabase project: `rqcqlpoxtdddjcylhopk`, `indiefindr-relaunch`, cirqplus organization, us-west-2. The existing archive's organization is Pro; creating there would incur compute charges, so it was not used. The existing free organization was verified before creation. No plan upgrades or paid services were purchased.

Loaded 25,555 games, 446 tags, and 327,809 recommendation rows. 18,785 games meet the settled indie rule. Major publisher names are normalized before matching. The merged model's saved score-ordered top-200 candidates are filtered with the indie mask before selecting ten. All 25,555 games now have exactly ten distinct indie model recommendations (255,550 model rows), and all 8,648 LLM source slates remain preserved (72,259 rows). Database assertions confirm zero missing model pages and zero non-indie targets. The original 786 empty model slates are fixed. Saved candidate SHA-256: `28d0d87e5eb1ef16702cf1a0f799eeb5e17bd11e5d0d7e10f0a3dce7252684cc`.

The app reads stored lists only, preferring LLM whenever present. Missing games return 404, without Steam fetching or database inserts. Search uses the loaded catalog. Retired collection/trainer routes, submit route, locks, rate limits, and generation code are archived outside the application. Migration history is preserved outside the active migrations directory; the fresh project has one migration. Raw Steam payloads remain outside the database.

Collection exports are in ignored `data/archive/`: five collections, 42 membership rows. The archive was queried within explicit read-only transactions. No matching trainer/BPR tables were present to export. All new database writes are guarded to the new project. Original main checkout WIP was not edited.

Tracking: visible-card impressions, card clicks, Steam clicks, tab session UUID, referrer, recommendation positions. The events table is not publicly writable/readable; same-origin validated events are inserted through a server route. Steam outbound links include UTM parameters. Events are operational analytics, not a payment ledger; bot-resistant attribution and retention still need future work.

SEO: canonical game pages, VideoGame and breadcrumb structured data, llms.txt, sitemap index plus paginated shards. Requests never generate recommendations. Numeric appid routes remain canonical to preserve existing links.

Validation: production build and TypeScript pass; ESLint has zero errors (one existing warning). Deployed game page and final sitemap shard returned HTTP 200 through Vercel CLI authenticated curl. Local functional checks passed for home, Stardew Valley, Elden Ring, catalog search, and a test event insertion. Initial Next metadata sitemap returned 404; replaced with explicit sitemap index/shard routes.

## Remaining authorized work

- Expand the source catalog to the full Steam set; copy the offline merged model pipeline and encoder, enrich through Steam's public batch API, rerank with indie eligibility before top-ten selection, and load the new project.
- Implement the free nightly offline ingest job on the Mac (MPS is required for encoding); no request-time inference.
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

## Latest steering

- bt approved retaining Supabase and the additional Micro project cost on the existing Pro organization: $0.01344/hour (about $10/month). No billing change has been applied yet. The Studio transfer preview rejects the CLI PAT with `401 Unsupported access token`, and Computer Use's browser host is unavailable. Required dashboard handoff: transfer `rqcqlpoxtdddjcylhopk` from cirqplus to `thinkhumanco` (`yyiklgfmyxbytyywfddh`) through project General settings; then apply `ci_micro` through the supported billing-addons API. Do not upgrade cirqplus or change the archive.
- All encoding and typecheck processes started on the user's Mac were stopped. Heavy processing moved to devbox (`host_57uprbbbx5`, `/Users/bot/dev/indiefindr-relaunch`). Native MPS is available there. The pinned environment, frozen models, normalized source, and completed embedding chunks were copied securely; the encoder reused the completed chunks. Remote terminal: `term_kmebjvhkt7`. It encodes, then scores, with two CPU threads. No expanded database upload is running.
- Full catalog acquisition/normalization completed: 200,896 games, including 793 preserved legacy pages; 235 unavailable/non-game entries excluded. The Free-plan capacity guard projects 729,321,838 bytes conservatively against a 500 MB entitlement and refuses expanded publication until the approved organization move is complete.
- The visual preview now has game-art heroes, a consistent search header, improved card layouts, and `Games like {title}` as the H1. Ad/affiliate components are implemented and disabled by default. The nightly installer is prepared for devbox but has not yet been installed; do not install it on the user's Mac.
