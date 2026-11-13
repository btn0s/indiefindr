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
