# Interaction-trained recommender: design + bootstrap plan

Part 2 of the [LLM-free suggestions experiment plan](./llm-free-suggestions-experiment-plan.md). Part 1 attacks **cost** (LLM off the request path). This doc attacks **latency and ceiling**: replace per-request generation with a **traditional item-item recommender** — learned embeddings, precomputed neighbors, millisecond serving — and solve the no-users cold-start by **manufacturing interaction data** with a purpose-built labeling task ("the trainer") run by LLM agents and, when available, real users.

The mental model: today the LLM *is* the recommender, run at request time (slow, expensive, stochastic). Here the LLM becomes a **data annotator** that runs in batches, and the recommender is a small vector model that never thinks at serve time.

---

## 1. Target architecture

### Serving (hot path — no LLM, no network, no generation)

```
game page request
  → SELECT precomputed neighbors FROM game_suggestions (or pgvector top-K)
  → render. ~5ms.
```

- Every game has a learned **similarity embedding** in `game_vibes.vibe_embedding` (pgvector, already provisioned with `find_similar_vibes`).
- A nightly job materializes top-K neighbors per game into `game_suggestions`, so the request path is a plain indexed read — the existing UI in `suggestions-section.tsx` doesn't change shape, the "generating…" state just disappears.
- **Explanations** are no longer generated per request: template them from shared signals ("Both cozy pixel-art farming sims", "Same developer", "Loved by the same players") at materialization time. If templated reasons feel flat, one cached LLM-written sentence per *promoted pair* is a bounded one-time cost, not a serving cost.

### The model (two towers, so cold start stays solved)

Pure collaborative filtering can't place a game with zero interactions — fatal for a discovery site that ingests new indies constantly. So:

```
item embedding e(g) = f_θ(content(g)) + r_g
```

- `content(g)`: fixed feature vector — text-embedding of title+description, weighted tag vector, **structured facet annotations (§1.5)**, developer hash, review ratio, log-owners. Computed once at ingest (Part 1, E2 infrastructure).
- `f_θ`: small learned projection (linear or 1-hidden-layer MLP) from content space into **similarity space**. This is what training fits.
- `r_g`: per-game residual, regularized toward zero, only learned for games with enough interaction evidence. New game → `r_g = 0` → it's placed purely by content through `f_θ`, which has *absorbed* the interaction signal. Cold start inherits everything the model learned.

Similarity = cosine in this space. Train with **triplet/BPR loss** on judgments: for seed `s`, picked `p`, shown-but-not-picked `n`:

```
loss = −log σ( e(s)·e(p) − e(s)·e(n) )
```

This is a few thousand parameters — trainable in seconds in a `tsx` script with no ML framework, checkpointed as JSON in the repo. Re-embedding the catalog after training is one matrix multiply per game.

### 1.5 Manufacturing the missing taste metadata (the facet problem)

The whole reason the custom multi-strategy system exists: **raw Steam sources don't carry taste/gameplay-feel data.** Tags say "Roguelike, Pixel Graphics"; nothing says *whimsical vs punishing*, *meditative vs frantic*, or that "cannons" here means charming pirates, not a shooter. The current pipeline compensates by having LLMs re-derive this per request. The recommender keeps the faceted insight but moves the derivation to **one-time, cached enrichment**:

1. **Facet annotation at ingest (one LLM call per game, ever).** Persist what `detectGameType` computes and throws away today, but richer — a structured record per game:

   ```jsonc
   // games_new.facets (JSONB), written once at ingest, versioned by prompt
   {
     "type": "cozy",                       // the existing GameType taxonomy
     "vibe": ["whimsical", "serene"],      // controlled vocabulary, not freeform
     "mechanics": ["deckbuilder", "base-building"],
     "pacing": "relaxed",                   // relaxed | moderate | frantic
     "tone": "lighthearted",                // controlled list
     "session_length": "short",
     "complexity": "low",
     "facet_version": "v1"
   }
   ```

   Controlled vocabularies (not freeform text) make these one-hot/embedding features for `content(g)`. Cost: ~$0.0005/game with a cheap model → the whole catalog plus every future ingest is dollars, total — versus re-deriving it on every page view.

2. **Review-text mining (free taste signal).** Steam review *text* is where players already say "cozy", "brutal but fair", "feels like Outer Wilds". Batch-extract facet mentions from the top ~30 reviews per game (cheap NLP keyword pass first; LLM extraction only where reviews are rich) and merge into the same facet record with a `source` marker. Also harvest explicit "feels like X" / "if you liked Y" mentions as **direct similarity pairs** for Source A.

3. **Facet-aware similarity, preserving the multi-strategy idea.** "Similar" isn't one scalar — the current system's vibe/mechanics/community split is real signal. Carry it through with **multi-head embeddings**: `f_θ` outputs 2–3 small sub-vectors (vibe head, mechanics head), and the serving score is a type-weighted combination — `getWeightsForType` reborn, but with weights *fit by E4/E8* instead of hand-tuned, and per-facet spaces trained on facet-labeled triplets (§2.4).

---

## 2. Interaction data: three sources, one schema

### 2.1 Schema (impressions logged, per the eval framework's Layer D)

```sql
create table judgment_sessions (
  id uuid primary key default gen_random_uuid(),
  source text not null,            -- 'human' | 'agent'
  agent_model text,                -- e.g. 'gpt-4o-mini'
  persona_id text,                 -- for agents; null for humans
  created_at timestamptz default now()
);

create table similarity_judgments (
  id bigserial primary key,
  session_id uuid references judgment_sessions(id),
  seed_appid bigint not null,
  shown_appids bigint[] not null,  -- the full impression set (critical: enables
                                   -- unbiased eval + propensity correction later)
  picked_appids bigint[] not null, -- "feels similar"
  best_appid bigint,               -- optional single strongest pick
  rejected_appids bigint[] not null default '{}', -- explicit "definitely not"
  facet text,                      -- null = overall similarity; 'vibe' | 'mechanics'
                                   -- when the screen asked a facet-specific question
  sampler_version text not null,   -- how candidates were chosen (see 2.4)
  latency_ms integer,              -- humans: trap for rubber-stamping
  created_at timestamptz default now()
);
```

One screen → one row → up to `picked × (shown − picked)` training triplets, plus hard negatives from `rejected_appids`. Ten seconds of human attention yields ~10–30 triplets.

### 2.2 Source A — Mined Steam co-engagement (free, real, do first)

Before paying anyone (agent or human) to *imitate* taste, mine actual taste:

- Steam's public reviews endpoint (`appreviews`) returns reviewer IDs per game. Reviewers with public profiles expose their other reviews. **Games co-reviewed by the same people** is the classic "players also liked" signal — exactly what commercial recommenders run on.
- Pipeline: rate-limited crawler (reuse `acquireRateLimit` from `steamspy.ts` patterns) → co-review count matrix over the catalog → PMI weighting (so co-occurrence with mega-hits doesn't dominate) → these pairs become high-weight positive triplets, or directly an item2vec-style pretraining corpus.
- Caveats: slow crawl (days, fine — it's free), only covers games with review volume (obscure indies stay content-only — that's what the content tower is for), respect private profiles and rate limits.

This grounds the embedding space in real human behavior at zero labeling cost. Trainer data then *corrects and refines* it rather than carrying everything.

### 2.3 Source B — Agent trainer runs (volume, cheap, must be calibrated)

A CLI (`scripts/trainer/run-agents.ts`) replays the exact same task a human would see:

- Input per call: seed game (title, description, tags) + 8 candidates (same fields), persona spec.
- One **cheap model** call (e.g. gpt-4o-mini with structured output: `{picked: [], best, rejected: []}`) ≈ $0.0005. **100k judgments ≈ $50**, generated overnight, with a hard budget flag on the CLI.
- Personas matter less than diversity of seeds/candidates, but keep 5–10 fixed persona specs ("cozy-only player", "mechanics purist", "art-game connoisseur") so the data doesn't collapse to one taste.
- **Calibration gate (same discipline as Part 1's judge):** before any bulk run, agents and a human label the **same ~100 screens**; require agreement (picked-set overlap) above a threshold (e.g. mean Jaccard ≥ 0.5, and near-zero disagreement on `rejected`). Agents that fail get prompt iteration against the human labels — never against model performance.
- Agent rows keep `source='agent'` forever, so training can down-weight them (start at 0.3× human weight) or drop them in ablations.

### 2.4 Source C — Human trainer (highest value per label, smallest volume)

A `/trainer` route (or local-only page) — deliberately game-like and fast:

- Show seed (header image + one line) and a 4×2 grid of candidate cards. Tap all that "feel similar to this", optional long-press for "best", swipe/X for "definitely not". Submit → next seed. Target < 10s per screen.
- **Candidate sampling is the experiment design** (and is versioned via `sampler_version`): each screen mixes
  - 3–4 current-model top picks (confirm/deny the model),
  - 2 **hard negatives** — high tag overlap but suspected vibe clash (the exact failure mode the LLM pipeline was good at catching; this is where human labels are worth the most),
  - 1–2 exploration picks (popularity-matched random) so the space gets coverage and the data isn't hopelessly biased toward the model's existing beliefs.
- **Facet-conditioned screens:** most screens ask plain "feels similar?"; a rotating fraction (~20%) asks a facet-specific question — "which of these *feels* like it?" vs "which of these *plays* like it?" — recorded in `facet`. These train the multi-head spaces (§1.5.3) so the model keeps the vibe/mechanics distinction the current system encodes by hand. Agents get the same split.
- You alone doing 15 min/day ≈ 90 screens/day ≈ ~2k triplets/day. Friends/early users multiply that. Every label also doubles as eval ground truth.

---

## 3. Training loop (the "trainer run")

All offline, all CLI, each run prints its label counts and dollar cost:

```
scripts/trainer/
  mine-steam-coreviews.ts   # Source A crawler → similarity_judgments (source='steam')
  run-agents.ts             # Source B batch labeling, --budget-usd cap
  train.ts                  # triplets → fit f_θ (+ residuals) → weights JSON artifact
  embed-catalog.ts          # apply f_θ to all games → game_vibes.vibe_embedding
  materialize.ts            # pgvector top-K per game → game_suggestions + templated reasons
  evaluate.ts               # Part 1 harness: judge/scorecard vs frozen baselines
```

Cadence: retrain when new labels accumulate or scorecard drifts — explicitly, never per-request. Each `train.ts` output is a versioned artifact; `materialize.ts` only promotes an artifact that passed `evaluate.ts` gates (Part 1 §5 decision rules apply unchanged).

---

## 4. Experiments (continuing Part 1's numbering and protocol)

Same fixtures: gold seed set, frozen E0 baseline, calibrated judge, holdout discipline.

### E6 — Co-engagement mining

- **Hypothesis:** PMI-weighted co-review similarity alone beats tag cosine (E1) on mid-popularity seeds, and embeddings pretrained on it beat content-only embeddings (E2) overall.
- **Method:** crawl → build co-review pairs → (a) raw PMI neighbor lists as an algo, (b) triplets pretraining `f_θ`. Judge both vs E1/E2 artifacts on holdout seeds.
- **Risks measured:** coverage (% of catalog with ≥ N co-review pairs), popularity bias (scorecard `popularity_skew`).

### E7 — Agent-fidelity gate

- **Hypothesis:** a cheap-model agent can reproduce human similarity picks well enough to be a volume label source.
- **Method:** 100 shared screens, you + 3 agent configs (model × prompt). Metric: picked-set Jaccard vs human, rejected-set agreement. **Pre-registered gate:** best config ≥ 0.5 mean Jaccard, else agents are demoted to pretraining-only data.
- **Spend:** < $1. Run before any bulk agent labeling.

### E8 — Learning curve (the headline experiment)

- **Hypothesis:** slate quality rises with triplet count and saturates within an affordable label budget.
- **Method:** fix the model; train on nested subsets — 0 (content-only prior) / 2k / 10k / 50k / 100k triplets (agent-generated, post-E7) — evaluate each on holdout with the judge. Plot win-rate-vs-baseline against label count.
- **Decision value:** tells you whether the trainer concept works *at all*, what labels cost to reach parity, and where to stop spending. If the curve is flat, the bottleneck is features or task design, not volume — stop and diagnose, don't scale.

### E9 — Human/agent ablation

- **Hypothesis:** small-human + large-agent mixed training beats either source alone on a **human-labeled** holdout.
- **Method:** train three variants (human-only ~2k, agent-only ~50k, mixed with agent down-weighting); same holdout. Also ablate Source A in/out.
- **Outcome:** the actual data recipe, with evidence.

### E10 — Cold-start regression gate (ship blocker)

- **Hypothesis:** new games placed by content tower alone (`r_g = 0`) get slates no worse than E2's content-kNN.
- **Method:** hold out 30 games *entirely* from training (no triplets, no co-review pairs); embed via `f_θ` only; judge their slates vs E2. **Gate:** non-inferior, since every freshly ingested game lives in this state.

### E11 — Facet-feature ablation (does manufactured metadata earn its keep?)

- **Hypothesis:** adding the one-time LLM facet annotations (§1.5) to `content(g)` measurably beats raw tags+description embeddings — i.e. the facet insight behind the custom system survives the move to cheap serving. Secondary: multi-head facet embeddings beat a single similarity scalar on the seed types where the hand-tuned weights differ most (avant-garde, competitive).
- **Method:** train identical models on identical triplets with content towers of (a) tags+text only, (b) +facet annotations, (c) +facet annotations with multi-head output and type-weighted scoring. Judge on holdout, per-type slices.
- **Decision value:** if (a) ≈ (b), skip the enrichment pipeline entirely; if (b) or (c) wins, the per-game annotation call becomes a permanent, justified part of ingest. This directly tests whether the faceted system's value lives in the *metadata* (cheap to keep) or in per-request LLM reasoning (expensive to keep).
- **Spend:** ~$2 annotations backfill + ~$2 judge.

### E12 — End-to-end bakeoff and promotion

- Winner of the E8/E9/E11 recipe, materialized via the full pipeline (train → embed → materialize), judged vs the frozen E0 LLM baseline on holdout seeds, per-type slices reported.
- **Promotion rule:** Part 1 §5 unchanged (win+tie ≥ 45%, hard gates on must-not/vibe-conflict, avant-garde slice gets the curated/audit fallback if it lags). Plus a new latency claim to verify honestly: p95 serve time from `game_suggestions` read, which should be ~3 orders of magnitude below the current generate path.

### Sequencing and budget

| Order | Item | Blocked by | Est. spend |
|---|---|---|---|
| 1 | Schema + trainer CLI skeleton | Part 1 infra | $0 |
| 2 | **E6** co-review mining + pretraining | 1 | $0 (time) |
| 3 | **E7** agent fidelity gate | 1 | < $1 |
| 4 | Human trainer route, start daily labeling | 1 | $0 |
| 5 | **E8** learning curve | 3 | ~$10–50 (agent labels) |
| 6 | **E9** ablation | 4, 5 | ~$5 |
| 7 | **E10** cold-start gate | 5 | ~$1 (judge) |
| 8 | **E11** facet-feature ablation | 5 | ~$4 |
| 9 | **E12** bakeoff + promotion | 6, 7, 8 | ~$2 (judge) |

Worst case ≈ **$75 total** to find out whether a trained item-item recommender can replace the per-request LLM pipeline — roughly the cost of E0's baseline measurement of the current system.

---

## 5. What this buys beyond cost

- **Latency:** suggestions render with the page; the skeleton/"generating" state and SSE polling for suggestions become dead code.
- **Determinism:** same seed → same slate between retrains; run-to-run stability stops being a metric we have to monitor.
- **Compounding asset:** every trainer session, agent run, and mined co-review permanently improves a model **you own**, instead of being burned in a one-off generation. The current pipeline's entire historical `game_suggestions` output also gets recycled as weak positives (Part 1, E3) — the money already spent becomes training data.
- **A real flywheel for later:** the impression-logged judgment schema is exactly the structure needed when real user signals (clicks, saves, "not this vibe") arrive — they append to the same table with `source='user_implicit'` and the same trainer consumes them. The bootstrap path and the production learning path are one system.
