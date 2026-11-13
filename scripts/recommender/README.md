# Offline merged recommender

This is the serving pipeline for the settled flat-tag + fine-tuned BGE-small → LambdaRank model. It never fits new weights or evaluates/selects models. It runs on the devbox Mac, keeping heavy work off bt's Mac; the Next.js deployment contains none of the model data.

`score.py` and `params.json` are copied without edits from the research workspace's handwritten scorer. `run.py` uses its exact features and global score normalization, the saved 22-feature merged LambdaRank, and the saved tag-trained encoder. Tags use the original flattened Steam representation plus linear TF–IDF cosine. Both retrieval lists are restricted to eligible indie games before union and ranking. The top ten use deterministic appid tie-breaking.

The pinned dependency graph is copied from the completed experiment. Install once with:

```sh
UV_CACHE_DIR="$PWD/data/uv-cache" uv sync --frozen --project scripts/recommender
```

Private model files are in ignored `data/model/`: `encoder/`, `ranker.txt`, and source provenance. The original exports and golden slates are copied into `data/relaunch-source/`. `.env.steam` supplies the existing Steam API key; `.env.relaunch-admin` permits writes only to the new relaunch project. None of these paths is uploaded to Vercel.

`scripts/relaunch/rebuild.sh` fetches the current Steam list and batches, normalizes metadata, encodes with native MPS, scores with two CPU threads, prepares compact imports, and publishes only after integrity and plan-entitlement capacity checks. Encoding and scoring use separate processes to avoid Torch/LightGBM runtime conflicts. Model output is resumable; encoding chunks are keyed by source text and encoder SHA, and ranking journals are bound to input hashes.

Raw Steam responses stay on disk. Genre IDs come from `extra_details.links_and_info.genreids`; ranked tags and review counts come from StoreBrowse. The current app list uses the authenticated free Store API, excluding DLC/software/video/hardware. Existing pages are preserved if games later disappear from the public list. Publisher precedence and Indie genre/tag classification share `scripts/relaunch/catalog.py`.

A capacity check refuses publication if the conservative projected size exceeds 90% of the plan's disk entitlement (8 GB on the approved Pro/Micro project). It never purchases anything, upgrades an organization, or changes production. A failed generation leaves the last published recommendations serving.

The nightly generation enriches media after publication and then updates `search/titles.json`. Media batches are keyed by the requested app IDs so catalog reorderings cannot reuse an unrelated batch. Search reports raw and gzip sizes and trims to reviewed games if the complete index exceeds 3 MB gzipped.

Target selection uses `scripts/relaunch/selection.py`: after indie masking and model ordering, allow at most two targets with ≥50,000 reviews and at most four with ≥10,000, counting the first tier toward the second. Skip capped candidates in order until exactly ten remain. Model slates record `lambdarank_merged-indie-full-v2-tilt-m2-4` and persist the complete ordered candidate IDs. Developers and major-owned studios are checked alongside publishers.

Public prices come exclusively from batched US Steam `appdetails?cc=us&filters=price_overview`, acquired by `us-prices.py` for all normalized IDs, including preserved legacy pages. Daily batch caches are resumable. Preparation rejects foreign currencies and never falls back to a legacy or bundle price; unavailable US prices are null. Normalization clears carried-over legacy prices. The acquisition is a locked nightly stage; no per-request Steam calls are involved.

## Model slates: 24 targets

`selection.py` owns the slate size (24), saved candidate limit (200), and nested popularity caps (at most 5 targets with ≥50,000 reviews and 10 with ≥10,000). Selection walks model order after strict indie eligibility and self/duplicate filtering. It returns fewer only if eligible saved candidates are exhausted; verification reports the short-slate count. New slates use `lambdarank_merged-indie-full-v3-24-tilt-m5-10`. Nightly scoring and saved-candidate selection share this policy.

`expand-slates.py --source data/full-source --out data/full-source/slates_24.jsonl` streams the saved score-ordered candidate IDs (first 200 per game), without fitting, encoding, or inference. `replace-model-recs.py --slates data/full-source/slates_24.jsonl` checks capacity, eligibility, uniqueness and caps before writes; atomically replaces model rows in batches; and verifies slate counts, targets, caps, and an unchanged LLM checksum afterward. It expands the existing rank constraint to 24, as does the full nightly publisher; no new migration files or frontend changes are needed.

The 24-row rollout exposed a retained 2 GB physical disk after the Pro/Micro move: WAL and data filled it and Supabase enabled read-only protection. The authorized disk is now 16 GB gp3 (3000 IOPS, 125 MiB/s, about $1/month beyond the included 8 GB). Capacity checks use the actual provisioned disk and physical usage, including WAL, plus projected relation growth and a WAL-growth reserve. Bulk replacement uses 100-source transactions, checks physical headroom before each write batch, and resumes by comparing exact stored targets/version. It uses natural checkpoints because Supabase denies explicit CHECKPOINT to postgres; no role elevation or guard override is used. The replacement ends with VACUUM (ANALYZE) and integrity checks.

The nightly installer pins the complete pipeline code by content hash under `data/nightly/releases/`, sharing data, private environment files, and the pinned Python environment via links. Launchd runs that release rather than the mutable source directory. Reinstall from updated approved code to activate a new release; installing a policy below the published 24-target minimum is refused. Source checkout/sync changes cannot downgrade an already-installed release. Verification uses narrow stored-array reads with shared checks for distinct/self-excluding indie targets, rank continuity, model version and nested caps.
