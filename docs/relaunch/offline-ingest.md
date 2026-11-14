# Offline catalog ingest

The devbox Mac owns acquisition, encoding, ranking, and publication. Next.js only reads the published data and serves cached pages. No LLM APIs, hosted model APIs, or paid Steam services are involved.

## Current-catalog coverage fix

All 25,555 existing source games have exactly ten distinct indie model targets. The merged model's saved top-200 is already in descending LambdaRank order. Selecting eligible targets before taking ten is equivalent to masking non-indie scores before selection. Every saved list contains at least ten eligible targets, so no alternate model or fallback list is required. LLM rows remain preserved and preferred.

## Full acquisition

The normalized full catalog contains 200,896 games, including preserved legacy pages; the approximately 122k handoff count is obsolete. `steam-catalog.py` fetches the entire game list through `IStoreService/GetAppList`, then obtains tags, review counts, descriptions, publishers, developers, assets, prices, and release data in 100-app batches through `IStoreBrowseService/GetItems`.

Genre IDs require `include_extra_details`; they are in `extra_details.links_and_info.genreids`. Existing batches from the initial fetch are supplemented with these details instead of refetching descriptions/assets. Complete responses are versioned on disk. Four I/O workers share a four-request/second limit, respect Retry-After, and retry transient failures. Failed refreshes retain the pending app IDs so a retry cannot lose metadata changes.

`normalize-steam.py` converts raw responses into the established scorer input contracts, stripping BBCode markup from long descriptions. Genre/category names use the original catalog's Steam IDs. The same publisher/Indie classification code is used for the database and model eligibility. Existing catalog pages are retained when the current list cannot return a game. Raw responses never enter Supabase.

## Rebuild and publication

Install the pinned Python environment as described in `scripts/recommender/README.md`. The private data directory contains copies of the saved encoder/ranker and original exports. From the worktree:

```sh
scripts/relaunch/rebuild.sh
```

The pipeline creates a generation directory, acquires and normalizes metadata, encodes with MPS, ranks offline, validates every source's ten recommendations, and publishes only to `rqcqlpoxtdddjcylhopk`. Metadata and scoring stages are sequential. CPU scoring uses two threads. Only one ingest may run at a time.

Publication checks the current organization's plan and database size. It refuses the upload if a conservative projection exceeds 90% of the plan entitlement: 500 MB on Free or 8 GB on the approved Pro/Micro project. Paid plans are checked, never bypassed. See https://supabase.com/docs/guides/platform/billing-on-supabase. It cannot upgrade the plan or make purchases. If capacity requires paid hosting, bt must approve the exact quoted plan before any change. The last published catalog remains available when an offline generation fails.

## Reproduction and provenance

The scorer code and parameter snapshot are copied unchanged from the completed merged experiment. The saved ranker has 22 inputs in its original feature order; there is no refitting or model selection. Its Fable feature keeps the global top-200 score normalization across the eligible catalog. Flat-tag and BGE candidate retrieval are restricted to indie targets before the union is ranked.

Encoding chunks are bound to the encoder SHA and exact source text. Ranking journals are bound to catalog, metadata, and ranker hashes, and recover only an interrupted final record. Finished source slates are published to disk atomically. Database model slates are replaced transactionally per source batch, preserving complete lists throughout publication.

The native scheduler uses an OS-owned file lock and a durable `data/active-run.json` stage manifest. Failed runs resume their completed generation, rather than starting another model run. Before a new encoding run, capacity is checked; a blocked publication can resume directly after approval without recomputing recommendations.

BB script automations have a 15-minute execution ceiling, so the long-running MPS pipeline uses a native macOS LaunchAgent instead of an agent automation. The installer schedules 03:15 local time, uses background priority, and writes stdout/stderr under `data/nightly/`. The job is installed and loaded on devbox at `/Users/bot/Library/LaunchAgents/gg.indiefindr.offline-ingest.plist`, with working directory `/Users/bot/dev/indiefindr-relaunch`; it is not installed on the user's Mac. It invokes no LLM and never modifies production deployment state.

The nightly generation enriches media after publication and then updates `search/titles.json`. Media batches are keyed by the requested app IDs so catalog reorderings cannot reuse an unrelated batch. Search reports raw and gzip sizes and trims to reviewed games if the complete index exceeds 3 MB gzipped.

Target selection uses `scripts/relaunch/selection.py`: after indie masking and model ordering, allow at most two targets with ≥50,000 reviews and at most four with ≥10,000, counting the first tier toward the second. Skip capped candidates in order until exactly ten remain. Model slates record `lambdarank_merged-indie-full-v2-tilt-m2-4` and persist the complete ordered candidate IDs. Developers and major-owned studios are checked alongside publishers.

Public prices come exclusively from batched US Steam `appdetails?cc=us&filters=price_overview`, acquired by `us-prices.py` for all normalized IDs, including preserved legacy pages. Daily batch caches are resumable. Preparation rejects foreign currencies and never falls back to a legacy or bundle price; unavailable US prices are null. Normalization clears carried-over legacy prices. The acquisition is a locked nightly stage; no per-request Steam calls are involved.

## Model slates: 24 targets

`selection.py` owns the slate size (24), saved candidate limit (200), and nested popularity caps (at most 5 targets with ≥50,000 reviews and 10 with ≥10,000). Selection walks model order after strict indie eligibility and self/duplicate filtering. It returns fewer only if eligible saved candidates are exhausted; verification reports the short-slate count. New slates use `lambdarank_merged-indie-full-v3-24-tilt-m5-10`. Nightly scoring and saved-candidate selection share this policy.

`expand-slates.py --source data/full-source --out data/full-source/slates_24.jsonl` streams the saved score-ordered candidate IDs (first 200 per game), without fitting, encoding, or inference. `replace-model-recs.py --slates data/full-source/slates_24.jsonl` checks capacity, eligibility, uniqueness and caps before writes; atomically replaces model rows in batches; and verifies slate counts, targets, caps, and an unchanged LLM checksum afterward. It expands the existing rank constraint to 24, as does the full nightly publisher; no new migration files or frontend changes are needed.

The 24-row rollout exposed a retained 2 GB physical disk after the Pro/Micro move: WAL and data filled it and Supabase enabled read-only protection. The authorized disk is now 16 GB gp3 (3000 IOPS, 125 MiB/s, about $1/month beyond the included 8 GB). Capacity checks use the actual provisioned disk and physical usage, including WAL, plus projected relation growth and a WAL-growth reserve. Bulk replacement uses 100-source transactions, checks physical headroom before each write batch, and resumes by comparing exact stored targets/version. It uses natural checkpoints because Supabase denies explicit CHECKPOINT to postgres; no role elevation or guard override is used. The replacement ends with VACUUM (ANALYZE) and integrity checks.

The nightly installer pins the complete pipeline code by content hash under `data/nightly/releases/`, sharing data, private environment files, and the pinned Python environment via links. Launchd runs that release rather than the mutable source directory. Reinstall from updated approved code to activate a new release; installing a policy below the published 24-target minimum is refused. Source checkout/sync changes cannot downgrade an already-installed release. Verification uses narrow stored-array reads with shared checks for distinct/self-excluding indie targets, rank continuity, model version and nested caps.

## Indie+ and Rising

**Indie+** is the notoriety line past which IndieFindr stops boosting a game: lifetime Steam reviews ≥ 10,000 (`selection.INDIE_PLUS_REVIEWS`, the same line as the recommender's second popularity cap). It covers 873 of 149,562 indies (top 0.6%). At the usual 30–60 sales per review, that is roughly 300k–600k copies sold. `prepare.py` stores `games.indie_plus`. Indie+ games stay searchable, remain valid seeds, and are still recommendation targets, capped at 10 of 24 slots (5 at ≥ 50,000). They never appear on the home discovery shelves. Review count is the only signal used: owner estimates are 99.6% missing, CCU needs one request per app with no history, and follower counts have no public API. Publisher size says nothing about whether a particular game is already known.

**Rising** ranks `games.momentum`: reviews in the last 14 complete UTC days, plus 20, divided by the reviews expected at the game's own pace over the 60 days before, plus 20. A game with under a week of earlier history counts as a launch and has an expected value of 0. A game qualifies only if it is an indie below the indie+ line, launched within 365 days, had at least 30 reviews in the window at ≥ 80% positive both recently and lifetime, and has momentum ≥ 1.5. Launch is the later of the first histogram bucket with votes and `steam_release_date`, so an early-access 1.0 release counts as a launch event; indie+ keeps relaunched giants out. `check-reviews.py` fetches each candidate's histogram in the same rate-limited, cached pass that serves review-bomb checks. Candidates are indies within the review band whose `steam_release_date` falls in the last year, about 3,200 nightly. The nightly publish rewrites every row's `momentum`, so the shelf moves on daily. Constants live in `review_quality.py`.

**Early Access** uses the same momentum and quality bar with no age gate, for indies Steam currently marks as Early Access (`games.is_early_access`, from `is_early_access` in the store data). Rising takes the released games and Early Access takes the rest, so the two never overlap. Early Access candidates add about 1,200 histograms to the nightly pass.

**Upcoming** ranks `games.upcoming_rank`, written by `upcoming.py` after the review stage. Unreleased games have no reviews, so it uses Steam's own wishlist order: store search `filter=popularwishlist` with the Indie tag, about 2,100 games over roughly 25 page requests. Wishlist counts are private, but the order is public, hard to game and is the platform's own anticipation measure. A game is kept if the catalog classes it as indie, Steam shows a day or month release date within 183 days (no quarter, year, "coming soon" or TBA placeholders), and its demo, if it has 10 or more reviews, is at least 80% positive. Demo review momentum was too sparse to rank by: in November 2026 only 7 upcoming indies' demos met the Rising volume bar. About 190 games qualify nightly.

**Home shelves** also exclude Steam adult-only titles (`games.is_adult`, content descriptor 3, set by `prepare.py`). New on Steam requires 10 or more reviews. Home shows Rising, Early Access, Hidden gems, New on Steam, then Upcoming. A game appears on at most one home shelf, the first to claim it in this order: Rising, Early Access, New on Steam, Upcoming, then the daily hidden-gems pick.
