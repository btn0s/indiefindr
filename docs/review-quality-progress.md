# Clean-review recommendations: continuation

Branch `btn0s/clean-review-recommendations`, off main. User/parent requested separate PR, do not merge, do not promote production. Metadata PR #48 is separately complete on `btn0s/game-metadata-line`; do not mix branches. Latest selected metadata preview: https://games-graph-f7fp5n7qe-thinkhumanco.vercel.app . Desktop/phone screenshots in BB thread storage `thr_3wc5d53kb8/metadata-comparison/chosen-{desktop,phone}.png`. Parent has links.

## Running work

Devbox SSH alias: `ssh devbox`; project `/Users/bot/dev/indiefindr-relaunch` (plain directory, not git). Isolated backfill source `data/clean-review-source` is an APFS copy of the published `data/full-source`. Scripts staged under `data/clean-review-tools`; main's `scripts/relaunch/prepare.py` and `selection.py` were restored after staging. Current nightly pipeline remains unchanged until the feature is verified. No inference or heavy work runs on bt's Mac.

Detached sequential job, log `data/review-check.log`:
1. `.venv` interpreter `scripts/recommender/.venv/bin/python data/clean-review-tools/check-reviews.py --source data/clean-review-source`
2. Same interpreter `data/clean-review-tools/prepare.py data/clean-review-source --out data/clean-review-import`
3. Same interpreter `data/clean-review-tools/review-impact.py --old data/full-import --new data/clean-review-import --source data/clean-review-source`

There are 20,881 histogram candidates. Four workers globally rate-limited to two request starts/second; cache `data/review-histograms/*.json`, single fetch lock. The 20,881 includes rated Mixed/below games plus explicit Big Walk detector test; games below ten reviews remain fully eligible. Check log and process before starting another copy. Resume with same command if interrupted; cached raw payloads avoid repeated calls.

No schema/data publication has happened for this feature yet. Additive migration `supabase/migrations/20261113150000_review_quality.sql` is committed but not applied. Only new Supabase project `rqcqlpoxtdddjcylhopk` may be written. Old project remains untouched. Existing private `.env.relaunch-admin` stores Management API token/ref, and `.vercel/preview.json` stores preview config; never print values. Org Pro transfer and $10 Micro compute were already confirmed/authorized.

## Decisions and implementation

- A rated target with clean score below 70 is removed; unrated / fewer than ten reviews remain eligible. No page is deleted.
- Steam default summary is authoritative unless a histogram spike is detected. Exclude both positive and negative votes in flagged intervals. No valid residual sample means no rescue.
- Daily recent bins take precedence. Weekly/monthly rollups cover earlier periods; overlapping daily counts are subtracted from boundary rollup. No double counting.
- Steam returns **monthly** rollups for old games, despite the original brief saying weekly. Parent was informed: same duration-normalized threshold with exact calendar-month length, actual resolution recorded, never pretend weekly precision.
- Baseline is median of actual recent daily downvote counts (including zeroes); weekly/monthly-only fallback uses per-day rates. Flag requires >=50 downvotes AND >=10x daily median times duration. Adjacent flagged bins merge.
- Big Walk fixture passes Nov 9–11 **Pacific display dates**, corresponding to Nov 10–12 UTC buckets. Votes removed: +1625 / -547. Date basis included in report.
- Offline prepare filters full stored ranked candidates **before** popularity caps/top ten; LLM lists retain eligible archive picks, then fill from model ranking. Resulting model and LLM slates both ten unique targets.
- Nightly code adds fresh 100-app default-summary requests (app modification timestamps do not cover review changes), then histograms for rated-low games or a >15 point drop vs previous snapshot. All raw blobs remain on disk.
- Page keeps real Steam score/label and adds a quiet “Review spike detected …; X% positive outside …” note only for rescued games. This is statistical detection, not proof of motivation.

## Next steps

1. Inspect `data/review-check.log`, `data/clean-review-source/review-quality-status.json`, and `data/clean-review-import/review-impact.{json,md}` when job finishes. Fix genuine API data edge cases if encountered, rerun from cache. Do not weaken eligibility or silently skip incomplete backfill.
2. Review ten most-recommended dropped and ten rescued targets/windows. Counts in impact report are based on prior published recommendation rows. Unrated retained counts explicitly included.
3. Run detector tests (`python3 scripts/relaunch/test-review-quality.py`), targeted ESLint, and Python compile checks. Six tests passed last run; targeted ESLint passed. Verify actual preparation results (all 10 rows, no duplicates, caps, no rated-low eligible mistakes).
4. Copy completed report to repo docs for review. Apply additive migration only to new project via Management API, then install coherent scripts to devbox (publisher/selection/prepare/run-ingest/refresh summaries/review quality/verify and scorer). Before overwriting main pipeline take a copy; no nightly model work on Mac.
5. Publish `data/clean-review-import` using updated `publish.py` only after validation. Keep existing capacity check; no paid changes. Preserve media columns (prepared rows omit them, REST upsert retains existing columns). Seed `data/latest-review-quality.json` for nightly comparison. Avoid scheduled nightly overlap by existing ingest lock.
6. Deploy preview with `vercel deploy --yes --scope thinkhumanco --local-config .vercel/preview.json` (remote build, no local build). New clean fields must exist in DB first. Use authenticated `vercel curl` for functional check.
7. Open own PR off main, do not merge. Report actual drop/rescue impact, top ten tables/windows and preview. Metadata PR #48 remains independent.

## Screenshots / evidence

CUA browser host unavailable. Parent explicitly authorized headless Playwright CLI. Chromium installed through `npx -y playwright@latest install chromium`. Preview auth: `vercel curl /games/322170 --deployment URL -- -s -H 'x-vercel-set-bypass-cookie: true' -c PRIVATE_COOKIE_FILE -o /dev/null`; parse cookie jar into private Playwright storage state without printing values. Use `npx -y playwright@latest screenshot --load-storage=PRIVATE_STATE --viewport-size=390,844 --wait-for-selector=.source-header ...`. Each deployment needs its own bypass cookie. Do not weaken Vercel protection. Delete cookie/state scratch afterwards. GitHub `gh attach upload` returned HTTP 404, so metadata evidence remains in thread storage. No screenshots committed.

## Remaining cautions

Histogram API may have unavailability or inconsistent overlap counts. Collector records a conservative default score/no rescue with unavailable reason, and report counts these. Network failures retry with shared cooldown / Retry-After, never log secrets. The live default Steam label is never replaced with adjusted label.
