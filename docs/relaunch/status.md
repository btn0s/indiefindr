# Relaunch checkpoint — 2026-11-13

Phase 1 preview: https://games-graph-4w64yifhz-thinkhumanco.vercel.app

Fresh Free Supabase project: `rqcqlpoxtdddjcylhopk`, `indiefindr-relaunch`, cirqplus organization, us-west-2. The existing archive's organization is Pro; creating there would incur compute charges, so it was not used. The existing free organization was verified before creation. No plan upgrades or paid services were purchased.

Loaded 25,555 games, 446 tags, and 260,221 recommendation rows. 18,785 games meet the settled indie rule. Major publisher names are normalized before matching. The original top-ten slates are filtered to indie targets without substituting a different ranking model: 786 model-only source slates become empty. All 8,648 LLM source slates retain eligible recommendations. Complete ten-game coverage requires reranking with the indie eligibility mask during the expanded offline run.

The app reads stored lists only, preferring LLM whenever present. Missing games return 404, without Steam fetching or database inserts. Search uses the loaded catalog. Retired collection/trainer routes, submit route, locks, rate limits, and generation code are archived outside the application. Migration history is preserved outside the active migrations directory; the fresh project has one migration. Raw Steam payloads remain outside the database.

Collection exports are in ignored `data/archive/`: five collections, 42 membership rows. The archive was queried within explicit read-only transactions. No matching trainer/BPR tables were present to export. All new database writes are guarded to the new project. Original main checkout WIP was not edited.

Tracking: visible-card impressions, card clicks, Steam clicks, tab session UUID, referrer, recommendation positions. The events table is not publicly writable/readable; same-origin validated events are inserted through a server route. Steam outbound links include UTM parameters. Events are operational analytics, not a payment ledger; bot-resistant attribution and retention still need future work.

SEO: canonical game pages, VideoGame and breadcrumb structured data, llms.txt, sitemap index plus paginated shards. Requests never generate recommendations. Numeric appid routes remain canonical to preserve existing links.

Validation: production build and TypeScript pass; ESLint has zero errors (two existing warnings). Local functional checks passed for home, Stardew Valley, Elden Ring, catalog search, and a test event insertion. Initial Next metadata sitemap returned 404; replaced with explicit sitemap index/shard routes.

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
