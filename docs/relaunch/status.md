# Relaunch checkpoint — 2026-11-13

Phase 1 preview: https://games-graph-jp1eb7p44-thinkhumanco.vercel.app

Supabase project `rqcqlpoxtdddjcylhopk` (`indiefindr-relaunch`, us-west-2) is now on the approved Pro organization with Micro compute and a verified 16 GB gp3 physical disk (3000 IOPS, 125 MiB/s). Publication checks a 14.4 GB physical operating budget including WAL; paid plans do not bypass capacity checks.

Published **200,896 games**, 446 tags, and **4,893,365 recommendation rows**: 4,821,504 model rows and 71,861 eligible archived LLM rows across 8,647 nonempty LLM slates. Every game has exactly 24 distinct indie model targets. Database assertions report zero incomplete model slates, zero non-indie targets, and zero medium-popularity-cap violations. The archived slate for source 32370 has no eligible targets under either rule on the full metadata and uses its complete model slate instead.

**196,305 games** have screenshots or trailers after full-catalog media enrichment. `search/titles.json` contains all 200,896 titles: 6,096,406 raw bytes, **2,780,693 gzip bytes**, below 3 MB, so no trimming was necessary. The uploaded public object matches its publication SHA-256. Native launchd job `gg.indiefindr.offline-ingest` is loaded on devbox for **03:15 local time**, invoking `rebuild.sh` / `run-ingest.py` with the OS file lock, background priority, and no LLM calls. No job was installed on bt's Mac.

The app reads stored lists only, preferring LLM whenever present. Missing games return 404, without Steam fetching or database inserts. Search uses the loaded catalog. Retired collection/trainer routes, submit route, locks, rate limits, and generation code are archived outside the application. Migration history is preserved outside the active migrations directory; the fresh project has one migration. Raw Steam payloads remain outside the database.

Collection exports are in ignored `data/archive/`: five collections, 42 membership rows. The archive was queried within explicit read-only transactions. No matching trainer/BPR tables were present to export. All new database writes are guarded to the new project. Original main checkout WIP was not edited.

Tracking: visible-card impressions, card clicks, Steam clicks, tab session UUID, referrer, recommendation positions. The events table is not publicly writable/readable; same-origin validated events are inserted through a server route. Steam outbound links include UTM parameters. Events are operational analytics, not a payment ledger; bot-resistant attribution and retention still need future work.

SEO: canonical game pages, VideoGame and breadcrumb structured data, llms.txt, sitemap index plus paginated shards. Requests never generate recommendations. Numeric appid routes remain canonical to preserve existing links.

Validation: production build and TypeScript pass; ESLint has zero errors (one existing warning). Deployed game page and final sitemap shard returned HTTP 200 through Vercel CLI authenticated curl. Local functional checks passed for home, Stardew Valley, Elden Ring, catalog search, and a test event insertion. Initial Next metadata sitemap returned 404; replaced with explicit sitemap index/shard routes.

## Remaining authorized work

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

The original top-ten-only scorer was stopped with parent authorization after the eligibility/tilt change. The new pass reuses all completed embeddings via `data/full-model-tilt`, applies the stricter developer/publisher indie mask, and saves complete model-ordered candidate IDs before selection. The new rule flips 44 games to non-indie, including Rocket League, Fall Guys and ARK; 149,562 games remain indie targets. Sources remain searchable regardless of eligibility. The shared medium tilt allows at most two targets with at least 50,000 reviews and at most four with at least 10,000 (including the first tier), with ordered fall-through. Slates record `lambdarank_merged-indie-full-v2-tilt-m2-4`. `finish-expansion.py` waits for the atomically completed slate file, then resumes the lock-protected ingest at prepare/publish, enriches all catalog media, publishes search, and installs the native 03:15 launchd job only after success. Its log is `data/finish-expansion.log`; the durable stage manifest is `data/active-run.json`.

The live capacity check confirms Pro: 151,975,603 current database bytes and a conservative expanded projection of 989,807,686 bytes, below the 7,200,000,000-byte operating budget. Media caches now use requested app IDs instead of unstable batch offsets. Search automatically trims to games with reviews only if its complete gzip size exceeds 3 MB. Publication preserves existing LLM slates when no incoming archived slate exists and verifies ten model rows per game and zero non-indie targets.

Publication, media enrichment, search, and launchd installation are complete. Final counts are recorded above and in devbox `data/publication-report.json`; the durable manifest is published. No `src/` edits or Vercel promotion were performed. PR: https://github.com/btn0s/indiefindr/pull/34.

Pricing correction: legacy rows retained foreign-currency amounts (Virtual Desktop Classic carried JPY 170000). Initial publication was interrupted after this report. US `appdetails` price acquisition now covers every catalog ID before preparation; public prices are exclusively canonical USD or null. Regression coverage exercises the actual preparation boundary with JPY legacy values, US replacements, and an unavailable price. The six reported app IDs are included in final database verification.

Final price verification passed: Virtual Desktop Classic $24.99; Rhythm Doctor $19.99; Rune Factory: Guardians of Azuma $59.99; Slay the Spire 2 $19.99; Desvelado $6.99; Crimson Desert $69.99. The initial publication was interrupted for the source price fix and successfully resumed. The first combined final-report query exceeded the database statement timeout; the report now aggregates each table once in separate queries, and verification passed. No outstanding run failures remain. Launchctl confirms the correct devbox working directory, 03:15 calendar trigger, background priority, and log paths; the scheduled job has not yet had its first calendar invocation.

## 24-target model rollout — verified 2026-11-13

Published 4,821,504 model rows across all 200,896 games: exactly 24 distinct, self-excluding indie model targets per game, with zero short slates. The 71,861 LLM rows remain unchanged by ordered checksum. Total recommendation rows: 4,893,365. The first 200 saved model-ordered candidates were filtered with the strict indie rule and selected with nested caps of 5 targets with ≥50,000 reviews and 10 with ≥10,000. Version: `lambdarank_merged-indie-full-v3-24-tilt-m5-10`. No fitting, encoding or inference was run for this expansion.

The actual provisioned disk was discovered to be 2 GB despite the Pro/Micro entitlement. It reached ~97.3% physical use, including ~805 MB WAL, and Supabase enabled read-only protection. The approved resize to 16 GB gp3 completed; Supabase automatically restored writes without a manual override. The additional 8 GB beyond the included allowance costs about $1/month. Capacity checks now inspect the provisioned disk and physical usage, with a WAL-growth reserve. Replacement resumed in 100-source transactions, checking physical headroom between batches and skipping exact already-published slates. Natural checkpoints are used as approved because the managed postgres role cannot issue CHECKPOINT; no role privileges were changed. VACUUM (ANALYZE) completed.

Final assertions passed for 24 targets on every game, distinct targets and contiguous ranks, current model version, zero non-indie targets, zero cap violations, and LLM checksum preservation. Combined large-join verification exceeded the statement timeout; shared verification now checks narrow stored arrays against live game metadata on devbox. Final report: `data/slates-24-publication.json`. PR: https://github.com/btn0s/indiefindr/pull/46.

A mutable devbox `selection.py` was found reverted to the old 10-target policy. Its writer could not be attributed: the directory is a non-Git copy with no reflog, launchd had never run and its logs were empty, and available BB thread logs did not identify a matching sync. The observed mtime is not proof of write time because rsync preserves it. The installer now pins a content-addressed snapshot of pipeline scripts under `data/nightly/releases/`, with read-only code files and shared data/environment links. The loaded 03:15 job points to the verified 24-target snapshot, so future mutable-checkout syncs cannot downgrade it. Snapshot regression coverage verifies that replacing the source policy with 10 leaves the installed release at 24 and refuses a downgraded reinstall.
