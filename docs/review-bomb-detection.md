# Review-bomb detection (v3, `steam-review-events-v3`)

Code: `scripts/relaunch/review_quality.py` (model), `review_topics.py` (local off-game text classifier), `steam_reviews.py` (cached, rate-limited Steam reads), `check-reviews.py` (catalog run), `evaluate-review-bombs.py` (scoring against ground truth). TS consumer: `src/lib/review-quality.ts`, whose `reviewBomb(game)` is the one thing the site reads (below).

## Which score is the truth

The headline score the site shows (`review_positive_pct`, from Steam's `summary_filtered`) is authoritative. It equals what `IUserReviewsService/GetAppReviews` reports with Steam's default filters: every language, off-topic periods left out, and Steam's purchase rule. That rule is Steam purchases for paid games and every purchase type for free-to-play ones (Apex Legends: 1.08M headline reviews, about 1.6k of them Steam purchases). The run picks whichever population reproduces the stored review count. Borderlands 2: 210,938 headline vs 210,919 from the API. Neos VR: 2,257 vs 2,256.

The review histogram (`appreviewhistogram`) counts a different population. It includes non-Steam keys and the off-topic periods, and it keeps each review's original vote and date. Neos shows 64% there because players later flipped positive reviews to negative, while its headline is 51%. The histogram is used only to find windows and judge their shape, never for the score.

So `clean_score` = headline minus each adjusted window, where the window counts (`steam_up`/`steam_down`) come from GetAppReviews with a date range and the headline's filters. If the API headline does not reproduce the stored score within 2 points, nothing is adjusted (`headline_mismatch: true`): like for like or not at all. A Steam-flagged period is already out of the headline and is never subtracted again. The v2 model subtracted histogram counts from histogram totals, which mixed populations and re-removed periods Steam had already excluded.

Steam retired `store.steampowered.com/appreviews?json=1` on about 22 Oct 2026 (it now redirects to the store front). GetAppReviews is the official, keyless replacement. A redirect is treated as a hard failure, never as zero reviews.

## Model

1. **Candidates (histogram only, every rated-low game).** A period qualifies when its rate of votes of one polarity is at least 4× the trailing baseline *and* 4 robust deviations above it (median and MAD of the previous ~6 months, normalised per day so daily, weekly and monthly buckets mix), *and* its share of that polarity is at least 25 points above the baseline share, with at least 30 such votes. Launch spikes, sales and free weekends raise volume without breaking sentiment, so they don't qualify. Launch periods with no history are compared with what follows. Adjacent periods merge, and an ongoing daily window may have up to two quiet days inside it. There is no majority rule: bombs draw counter-reviews (Borderlands 2's flagged April 2019 month was 46% negative against a 10% baseline).
2. **Shape (histogram).** Sentiment in the year before, during, and in the 2 years after the window (skipping a 28-day decay tail). A window is *live* until at least 60 days of history exist after that tail; live windows are judged on evidence alone and re-judged every nightly run.
3. **Evidence (GetAppReviews, negative windows only, none of it needs data from after the window).** Window counts in the headline population, plus up to 100 negative reviews from the window, spread over four equal slices so a short burst inside a long window is not missed, against up to 100 negative reviews from the year before. The samples include every purchase type and off-topic period, so they are judged blind to Steam's own label. Grouped into three families:
   - **what** they write about: the share of reviews about things outside the game (publisher, politics, DRM, pricing, region, store or launcher changes) from `review_topics.py`, a zero-shot nearest-prototype classifier over `paraphrase-multilingual-MiniLM-L12-v2` embeddings (local, multilingual, no LLM). Abandonment and in-game monetisation count as *on* the game: players leaving over them is a real decline. Signal: ≥30% and ≥20 points over baseline.
   - **who** is reviewing: under-2h playtime (+25 points), first-ever reviews (+20), free keys (≥30%, +20), or a language-mix shift of 35% or more (total variation distance). GetAppReviews no longer returns games owned or account age.
   - **coordination**: copy-paste text ≥15%, or one new word in ≥35% of reviews at ≥4× its baseline share.
   The opposite reading, **players**, is established players writing about the game: off-game share within 10 points of baseline (or ≤15%), playtime no lower than baseline (+10 points tolerance), no *who* or copy-paste signal.
4. **Verdict, with a one-sentence reason carrying the numbers:**
   - `steam_flagged`: overlaps a Steam `past_events` label. Reported; never subtracted.
   - Hindsight (enough history after the window):
     - `bomb` (recovered): sentiment afterwards recovered ≥60% of the drop and settled within 10 points of before (or above).
     - `bomb` (outsiders): the reviewers came from another language community (mix shift ≥35%). Regional campaigns about pricing, politics or platform bans are the commonest bombs Steam labels, and they can stay negative for months.
     - `bomb` (partial recovery, ≥40% and within 20 points, plus at least two evidence families).
     - `decline`: sentiment stayed down. Players changed their minds (a broken update, monetisation, abandonment, a company dispute). Never adjusted.
   - Live (open or too recent):
     - `active_bomb`: at least two evidence families. Adjusted now, and the reason says so.
     - `decline`: the *players* reading. Not adjusted.
     - `unresolved`: anything else. Stored for re-judging, never adjusted, never reported to the site.
     - A live window with fewer than 20 reviews before it has no break to judge (a new game's bad launch week is not a bomb): `unresolved`, not shown.
   - Steam flags large bombs while they are still under way: on 14 Nov 2026, PUBG and Dead by Daylight carried open-ended flags, Dead by Daylight's 13 days in. Once that flag appears, the nightly re-judge settles the window as `steam_flagged`.
5. **Nightly re-judging.** `check-reviews.py` rechecks every game with an `active_bomb` or `unresolved` window, whatever its score, and refetches the headline and open windows daily. Once after-data exists, recovery confirms the verdict or flips it to `decline`, and the score follows.
6. **Positive bursts** go through the same candidate test and are reported in `positive_windows` (`positive_bomb` if they faded, `rise` if they lasted). They are never subtracted. The score is only used to keep sub-70% games out of recommendations, so removing a positive burst could only lower a score that is already under the gate, and positive bursts are far more often real players (a fix, a free weekend) than a brigade. Steam's labels already remove flagged bursts of either sign.

`bomb_windows` (stored on every game row) is kept lean: adjusted windows (`bomb`, `active_bomb`, `adjusted: true`) plus open `unresolved` windows (`adjusted: false`, kept for re-judging). Each carries dates, histogram `up`/`down`, `steam_up`/`steam_down`, `verdict`, `adjusted`, `reason` and `shape`. Only adjusted windows can rescue a game (`eligible` / `reviewBomb`); rows from before v3 carry no flag and only ever stored negative-majority windows. `review_events` in `review-quality.json` keeps every window with its full evidence.

## What the site reads

One question: is this game rated Mixed or below because it was review-bombed? `reviewBomb(game)` in `src/lib/review-quality.ts` answers it and returns `{ ratingBefore, ratingNow, when, active }`, or null. It is non-null only when Steam's rating is under 70% (Mixed or below) and `clean_score`, Steam's reviews without the adjusted windows, is 70% or more. A bomb that no longer keeps the game out of the positive range is never reported, and an `unresolved` window never is. The same rule keeps such games in recommendations (`recommendationEligible`, and `eligible` in `review_quality.py`). The agent API returns it as `review_bomb`.

## Cost

One histogram request per rated-low game (about 20.9k) at 2 requests/second, plus about a dozen GetAppReviews requests per game with negative windows (around 200 games across the catalog). Raw responses are cached under `data/review-cache/` (histograms by appid, reviews by URL hash). A `--refresh` run refetches histograms, the headline and live windows daily; closed windows stay cached. `--offline` rescores from the cache with no network, about 3 minutes for the catalog. The topic model must be in `HF_HOME` (`python review_topics.py --download` once); the run uses the recommender venv for `sentence-transformers`.

## Evaluation

`python scripts/relaunch/evaluate-review-bombs.py --source <run source> [--catalog catalog.json]` writes `data/review-eval/report.{md,json}`. The ground truth is:

- `scripts/relaunch/fixtures/review-bomb-labels.json`: 52 press-sourced cases (28 bombs, 20 declines, 4 positive bombs), including Neos VR, Onward, Heartbound and Borderlands 2, with sources and hard-case notes.
- Every Steam `past_events` label in the cached histograms, used for recall only (an unflagged window may still be a bomb).

The new model is scored blind to Steam's labels; the old model is frozen inside the evaluator. Two settings: hindsight (today's full history) and *judged at the time*, where history is cut off 21 days into each labelled window and only the live verdict counts.

Results on 14 Nov 2026 (precision / recall on the 48 labelled bombs and declines):

| Setting | Old v2 | New v3 |
|---|---|---|
| Hindsight | 0.53 / 0.57 (14 false adjustments) | 0.91 / 0.75 (2) |
| Judged at the time | – / 0.00 | 1.00 / 0.25 (0) |

Steam-labelled windows: 47 in 41 games. v2 overlapped 49%; v3 finds 64% and calls 40% bombs while blind to the label. Catalog of 20,880 rated-low games: v2 adjusted 687 and lifted 63 over 70%, 12 of them by re-subtracting a window Steam had already excluded. v3 adjusts 57 (1 active bomb) and lifts 6. It also shows 3 open windows without adjusting them.

## Known limits

- **Declines that later recover look like bombs.** Counter-Strike 2's launch and PAYDAY 2's 2015 microtransactions both came back within 10 points. Shape cannot tell a fixed decline from a bomb.
- **Off-topic drops that never recover are left alone.** Heartbound (Pirate Software controversy) is labelled a bomb in the press set, but sentiment stayed at about 11%. By design the model will not adjust a drop that lasts unless the reviewers came from outside the game's community.
- **Live judging is deliberately cautious.** Three weeks in, it adjusts only the clearest coordinated campaigns (the 2019 Epic-exclusive bombs, Rocket League, regional waves). Most bombs show as `unresolved` until recovery confirms them. Bombs by a game's own players about the game (Skyrim paid mods, GTA V's OpenIV ban, SUPERHOT VR's cut content) look like declines while they happen.
- **Bombs of 1–5 days inside monthly buckets are often missed** (Cyberpunk 2077 March 2022, DOOM Eternal May 2020). They barely move all-time scores, and Steam handles the flagged ones.
