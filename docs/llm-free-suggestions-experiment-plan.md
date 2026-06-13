# Experiment plan: LLM-free suggestion serving

**Goal:** serve "games like X" slates with **zero LLM calls on the request path**, at quality statistically indistinguishable from (or acceptably close to) the current pipeline — verified by controlled experiments, not vibes.

LLM spend becomes **bounded and offline**: one-time per-game enrichment at ingest, plus explicit CLI training/eval runs with a fixed budget. Production serving is pure Postgres.

**Related docs**

- [Interaction-trained recommender (Part 2)](./interaction-trained-recommender.md) — the follow-on plan: traditional item-item recommender trained on bootstrapped interaction data (trainer task, agent + human labeling, co-review mining), experiments E6–E11.
- [Recommendation evaluation framework](./recommendation-evaluation-framework.md) — the eval stack (pairwise human eval, scorecard, gold set) these experiments plug into.
- [Case study](./case-study-suggestion-system.md) — how the current pipeline evolved.
- [`scripts/experiments-v2/`](../scripts/experiments-v2/README.md) — previous round (prompt variants; all still LLM-serving). This plan is the successor.

---

## 1. Why: cost anatomy of the current pipeline

### Cost per suggestion run

One call to `suggestGamesVibe` ([`src/lib/suggest.ts`](../src/lib/suggest.ts)) makes:

| Stage | Model | Calls (best case) | Calls (worst case) |
|---|---|---|---|
| Type detection | `openai/gpt-4o-mini` | 1 | 1 |
| 3 strategies (vibe/mechanics/community) | `perplexity/sonar` | 3 | 9 (each retries ×3 on parse failure) |
| Per-strategy retry if < 3 results | `perplexity/sonar` | 0 | +9 |
| Full-pipeline retry if consensus < 4 | `perplexity/sonar` | 0 | +9–18 |
| Curation | `openai/gpt-4o-mini` | 1 | 1 |

So **5 calls best case, ~20–35 worst case**. Perplexity Sonar is search-grounded and charges a per-request search fee on top of tokens, so it dominates: roughly $0.005–0.01/call → **~$0.02–0.30+ per slate** depending on retry amplification. The gpt-4o-mini calls are noise by comparison.

### Why cost scales with zero users

Two structural amplifiers:

1. **Page-view trigger.** [`suggestions-section.tsx`](../src/app/games/%5Bappid%5D/suggestions-section.tsx) auto-submits `generateSuggestions` for any game page with no `game_suggestions` rows. Any visitor — including **crawlers and prefetchers** — fires a full pipeline run.
2. **Ingest fan-out.** Each slate inserts ~10 suggested games; up to `MAX_AUTO_INGEST` (6) missing ones are auto-ingested with `skipSuggestions=true` — but their pages then auto-trigger their own runs on first view (see 1). Each generation of the crawl frontier multiplies spend: 1 submitted game → ~6 new pages → ~36 → …

**Cost model:** `spend = runs/day × cost/run`, where `runs/day` is driven by bot traffic over the auto-ingested frontier, and `cost/run` is inflated by retry amplification. Experiments below attack `cost/run → ~0` on the request path; §7 lists immediate stop-the-bleed fixes for `runs/day` that don't need experiments.

---

## 2. Core hypothesis and non-goals

**H0 (core):** A retrieval + scoring algorithm over data we already store (Steam tags, descriptions, developers, reviews, one-time embeddings) can produce slates that human/judge pairwise eval rates at parity with the LLM pipeline for most seed types, at ≤ 1% of the marginal cost and with deterministic, instant serving.

**H1 (training):** Where hand-tuned scoring falls short, we can *distill* the LLM pipeline's judgment into the cheap algorithm: use LLM-as-judge and the accumulated `game_suggestions` corpus as training labels for a small learned scorer, trained offline via CLI. The LLM teaches; it doesn't serve.

**Expected weak spot (state it up front):** avant-garde/art games. Tag and embedding similarity will likely under-perform the Perplexity community-search strategy for the weird stuff. The experiments measure this slice explicitly rather than hiding it in an average; the fallback is a curated/manual path for that slice, not LLM-per-request for everyone.

**Non-goals:** personalization, taste briefs, online A/B (no traffic to power them). This is strictly seed → slate, evaluated offline per the eval framework.

---

## 3. Shared infrastructure (build once, before any experiment)

All experiments share the same fixtures so results are comparable.

### 3.1 Gold seed set (`scripts/eval/gold-seeds.json`)

~60 seeds, **stratified**, frozen and versioned in git:

- 10 per `GameType` (avant-garde, cozy, competitive, narrative, action, mainstream) — type assigned by hand, not by `detectGameType`, so type-detection errors don't contaminate the eval.
- Within each type, mix popularity tiers (mega-hit / mid / obscure by SteamSpy owners).
- Include known failure-mode seeds from the case study (e.g. whimsical-game-gets-shooters).
- Split **by seed**: 40 train / 20 holdout. Holdout seeds are never used for weight fitting or prompt iteration. Per-type holdout slices are small (~3 seeds), so treat per-type holdout numbers as smoke signals; use the train set with cross-validation for per-type conclusions.

Each row uses the eval-case template from the framework doc (`must_match`, `must_not`, `acceptable_surprise`).

### 3.2 Runner CLI (`scripts/eval/run.ts`)

```
npx tsx scripts/eval/run.ts --algo <name> --seeds gold-seeds.json --repeat 3 --out runs/<timestamp>-<algo>.json
```

- `--algo` selects a **suggester function** with one shared signature: `(seed: GameNew, k: number) => Promise<Slate>`. The current pipeline is registered as `llm-baseline`; every candidate registers alongside it.
- Output artifact per run: seed, slate (appids + reasons), per-stage timing, **counted API calls and estimated $** (instrument `generateText` with a wrapper that tallies calls/tokens — this is also how Experiment 0 measures the baseline honestly), and diagnostics (consensus, verified rate where applicable).
- Deterministic algos run `--repeat 1`; stochastic ones `--repeat 3` so we can report run-to-run stability (mean pairwise Jaccard between repeats of the same seed).

### 3.3 Automatic scorecard (`scripts/eval/score.ts`)

Cheap, deterministic metrics over a run artifact — no LLM, runnable on every commit:

| Metric | Source |
|---|---|
| `tag_similarity_mean` / `min` | `calculateTagSimilarity` in [`src/lib/utils/steamspy.ts`](../src/lib/utils/steamspy.ts) |
| `vibe_conflict_rate` | `hasVibeConflict` (horror↔wholesome etc.) |
| `must_not_violation_rate` | gold-seed `must_not` lists, keyed to tags |
| `popularity_skew` | median SteamSpy owners of slate vs seed tier |
| `redundancy` | same-franchise / same-dev duplicates per slate |
| `self_or_dlc_rate` | slate contains seed, its DLC, or its soundtrack |
| `catalog_coverage` | % of slate already in `games_new` (proxy for fan-out cost) |
| `stability` | Jaccard across repeats |
| `cost_per_slate_usd`, `p95_latency_ms` | from runner instrumentation |

The scorecard is a **guardrail**, not the optimization target (Goodhart). Promotion decisions use pairwise judgment (3.4); the scorecard catches regressions cheaply between judge runs.

### 3.4 Pairwise judge (`scripts/eval/judge.ts`) — calibrated before trusted

- LLM judge compares two **blinded, order-randomized** slates for the same seed using the rubric in the framework doc (fit / constraints / discovery / coherence; explanations judged separately since non-LLM algos produce templated reasons). Judge prompt and model are **frozen and versioned**; changing them invalidates cross-run comparisons.
- **Calibration experiment (gate):** before any algo comparison, collect ~50 human pairwise labels (you, via a tiny CLI that shows two slates and asks "which, or tie"). Compute judge–human agreement. **Gate: ≥ 70% agreement on non-ties.** If the judge fails, iterate on the judge prompt against the *human labels* (never against algo results), or fall back to human-only labeling for headline numbers.
- Judge cost is the experiment budget: ~60 seeds × ~$0.002–0.01/comparison ≈ **$0.50–1 per full bakeoff**. That's the entire recurring LLM spend of this program.

---

## 4. The experiments

Each follows the same protocol: **hypothesis → independent variable (one thing changes) → fixed gold set → metrics → pre-registered success criteria → decision.**

### Experiment 0 — Baseline measurement (no changes, just truth)

*You can't claim improvement without knowing where you are.*

- **Questions:** What does the current pipeline actually cost per slate? How stable is it run-to-run? What's its scorecard profile per seed type? And in production: what triggers runs?
- **Method:**
  1. Run `llm-baseline` over all 60 gold seeds, `--repeat 3`. Record cost/slate distribution (incl. retry amplification frequency), latency, stability, scorecard.
  2. **Self-consistency check:** judge repeat-run pairs against each other. If the pipeline beats *itself* in ~50/50 with low Jaccard, its output is high-variance — which loosens how big a win any challenger needs to show, and is itself a finding.
  3. Add a `trigger` column/log to every production `suggestGamesVibe` call (`ingest` / `page_view` / `manual_refresh`) and tally a week of data to confirm the bot-traffic hypothesis from §1.
- **Deliverable:** baseline run artifact (frozen; all later experiments compare against it) + one-page cost report.
- **Estimated spend:** 180 pipeline runs ≈ $5–50 depending on retry behavior — the most expensive experiment in this plan, and it only runs once.

### Experiment 1 — Tag-vector similarity (zero AI anywhere)

- **Hypothesis:** weighted Steam tag overlap + simple priors reaches parity for mainstream/cozy/competitive/action seeds.
- **Algorithm (`tags-v1`):** score every candidate in `games_new` by weighted tag cosine (SteamSpy tag weights or position-weighted store tags via `tagsArrayToRecord`), plus a same-developer bonus, indie prior (penalize mega-owners when seed is small), review-ratio floor, and hard `hasVibeConflict` filter. Pure SQL/TS; no network calls at serve time.
- **Prerequisite:** backfill `steamspy_tags` for all of `games_new` (columns exist since migration `20260108000002`; one rate-limited batch script) and fetch tags at ingest going forward.
- **Known limitation:** candidates come only from `games_new` (currently suggestion-fan-out biased). Run a catalog-size sensitivity check — score slates with the catalog artificially halved — to estimate how much quality depends on catalog breadth, and expand ingestion (e.g. top-N indie tags crawl) if it's the bottleneck.
- **Success criteria:** judge win+tie ≥ 45% vs `llm-baseline` overall (non-inferiority, see §5) **and** ≥ 45% on every non-avant-garde slice; `must_not_violation_rate` ≤ baseline.
- **Spend:** ~$1 (judge only).

### Experiment 2 — Embedding kNN (AI once per game, amortized)

- **Hypothesis:** one-time embeddings capture the "vibe" that raw tags miss (tone words in descriptions), closing most of the gap on narrative/cozy seeds.
- **Algorithm (`embed-v1`):** embed `title + short_description + top tags` with a small embedding model (~$0.02 per 1k games — one-time); store in the existing `game_vibes.vibe_embedding` pgvector column; serve via the existing `find_similar_vibes` SQL function + the same filters as `tags-v1`. New games get embedded inside `ingest()` — one cheap call per game, ever.
- **Variant (`embed-v2`, only if v1 promising):** embed an LLM-written one-paragraph vibe summary (the `game_vibes.vibe_summary` column was built for exactly this) instead of raw description — one gpt-4o-mini call per game at ingest, still amortized.
- **Success criteria:** same non-inferiority gate as E1; additionally beats `tags-v1` head-to-head on narrative+cozy slices (otherwise tags win on simplicity and E2 is dropped).
- **Spend:** ~$1 embeddings backfill + ~$1 judge.

### Experiment 3 — Learned reranker, distilled from the LLM ("training runs")

This is the train-offline / serve-cheap centerpiece.

- **Hypothesis:** a small learned model over hand-crafted features recovers most of the LLM pipeline's curation judgment.
- **Features per (seed, candidate):** tag cosine, embedding cosine, shared-developer, review ratio, log-owners gap, release-era gap, seed-type one-hot × each (so weights can vary by type), vibe-conflict flag.
- **Labels (distillation, all generated offline via CLI):**
  - *Weak positives:* accumulated `game_suggestions` rows — the LLM pipeline's historical output, already paid for. Negatives: random catalog games matched on popularity tier.
  - *Preference labels:* for the 40 training seeds, have the frozen judge rank candidate pools → pairwise preferences.
- **Model:** logistic regression first (a weight vector you can read and ship as JSON); gradient-boosted trees only if LR clearly underfits. Serving = retrieve top-200 by embedding/tags, apply the weight vector. Still zero LLM calls.
- **Protocol:** fit on train seeds, evaluate on the 20 holdout seeds the model has never seen. Report overfit gap (train vs holdout win rate). Retraining is an explicit CLI run with a printed dollar cost, run when the catalog or scorecard drifts — not on a schedule, never per-request.
- **Success criteria:** beats the best of E1/E2 on holdout judge win rate; overall win+tie vs `llm-baseline` ≥ 50%.
- **Spend:** ~$2–5 (judge labeling of training pools + final bakeoff).

### Experiment 4 — Black-box weight tuning (cheap optimizer, LLM fitness)

- **Hypothesis:** even without a learned model, directly optimizing E1/E2's hand-built score weights (per `GameType`, like `getWeightsForType` does today) against judged quality beats hand-tuning.
- **Method:** grid or CMA-ES over the weight vector; fitness = scorecard composite on train seeds with periodic judge spot-checks (full judge fitness on every candidate is affordable but slow; the scorecard pre-screens). Evaluate winner on holdout.
- **Run order note:** E4 is cheaper than E3 and shares its infrastructure — run it first if E1/E2 come close to the gate and just need tuning; skip straight to E3 if they miss badly.
- **Spend:** ~$1–3.

### Experiment 5 — Hybrid: cheap serving + budget-capped LLM audit

Only if a pure-cheap winner has a stubborn bad slice (likely avant-garde).

- **Hypothesis:** quality of the worst slates improves materially when a nightly batch job re-curates only the bottom decile by scorecard, under a hard monthly budget cap.
- **Method:** serve everything from the cheap algorithm; a cron CLI ranks slates by scorecard, sends the worst N to the existing LLM curation (or replaces them with manually curated lists for known art-game clusters — `KNOWN_ARTGAME_DEVS` already enumerates them), writes results back to `game_suggestions`. Requests never wait on an LLM.
- **Success criteria:** avant-garde slice win rate recovers to within tolerance, with audited spend ≤ the cap (e.g. $5/month).

---

## 5. Decision rules (pre-registered)

- **Headline metric:** pairwise win+tie rate vs the frozen E0 baseline artifact, judged by the calibrated judge, on holdout seeds.
- **Non-inferiority, not superiority:** the challenger doesn't need to *beat* the LLM pipeline; given a ~100–1000× cost reduction and instant serving, **win+tie ≥ 45%** (i.e. losing slightly is acceptable) promotes — *except* `must_not_violation_rate` and `vibe_conflict_rate` must be ≤ baseline (hard gate, per the framework's ship-blocker rule).
- **Slices over averages:** report every metric per `GameType`. A challenger that's great on average but craters avant-garde ships **with** E5's audit path or a curated fallback for that slice — never silently.
- **Sample-size honesty:** with 20 holdout seeds, win-rate differences under ~20 points aren't significant (binomial; at 20 trials the 95% CI on a proportion is roughly ±20 points). Treat 45% vs 55% as a tie; use the human-label batch to break real ties. Don't run 10 variants and pick the luckiest (multiple comparisons).
- **Promotion = flip one call site.** All three production triggers funnel through `suggestGamesVibe`; the winner replaces it behind the same signature, with the LLM pipeline kept registered in the eval CLI as the reference baseline.

## 6. Sequencing and budget

| Order | Item | Blocked by | Est. LLM spend |
|---|---|---|---|
| 1 | §7 stop-the-bleed fixes | — | $0 (saves money) |
| 2 | Infra: gold set, runner, scorecard | — | $0 |
| 3 | Judge calibration vs ~50 human labels | 2 | ~$1 |
| 4 | **E0** baseline measurement | 2 | $5–50 (once) |
| 5 | Tag backfill + **E1** | 4 | ~$1 |
| 6 | Embedding backfill + **E2** | 4 | ~$2 |
| 7 | **E4** weight tuning (if E1/E2 are close) | 5/6 | ~$2 |
| 8 | **E3** learned reranker (if needed) | 5/6 | ~$5 |
| 9 | **E5** hybrid audit (if a slice lags) | promotion | capped, ~$5/mo |

Total experimental budget: **on the order of $20–70, mostly E0** — i.e. less than the production pipeline plausibly burns in days of bot traffic today.

## 7. Stop-the-bleed (do immediately; orthogonal to the experiments)

These don't change the algorithm, so they need no experiment — just guardrails:

1. **Kill the page-view trigger for bots:** don't auto-submit generation from `SuggestionsLoader`; require a user gesture (button) or at minimum skip known bot user-agents, and rate-limit `generateSuggestions` per IP like `/api/games/submit` already is.
2. **Never regenerate silently:** if a completed run exists for an appid (any age), serve it; regeneration only via explicit refresh.
3. **Cap retry amplification:** move `MIN_HIGH_CONSENSUS` full-pipeline retry and per-strategy retries behind a single max-total-Sonar-calls budget per run (e.g. 6) in `src/lib/config.ts`.
4. **Pause `autoIngestMissingGames` fan-out** beyond depth 1 from a user-submitted game (tag auto-ingested rows and don't auto-generate suggestions for their pages).
5. **Log `trigger` + cost per run** (also needed for E0) so the bleed is visible on a dashboard, not in an invoice.
