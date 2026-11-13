# Offline merged recommender

This is the serving pipeline for the settled flat-tag + fine-tuned BGE-small → LambdaRank model. It never fits new weights or evaluates/selects models. It runs on the devbox Mac, keeping heavy work off bt's Mac; the Next.js deployment contains none of the model data.

`score.py` and `params.json` are copied without edits from the research workspace's handwritten scorer. `run.py` uses its exact features and global score normalization, the saved 22-feature merged LambdaRank, and the saved tag-trained encoder. Tags use the original flattened Steam representation plus linear TF–IDF cosine. Both retrieval lists are restricted to eligible indie games before union and ranking. The top ten use deterministic appid tie-breaking.

The pinned dependency graph is copied from the completed experiment. Install once with:

```sh
UV_CACHE_DIR="$PWD/data/uv-cache" uv sync --frozen --project scripts/recommender
```

Private model files are in ignored `data/model/`: `encoder/`, `ranker.txt`, and source provenance. The original exports and golden slates are copied into `data/relaunch-source/`. `.env.steam` supplies the existing Steam API key; `.env.relaunch-admin` permits writes only to the new relaunch project. None of these paths is uploaded to Vercel.

`scripts/relaunch/rebuild.sh` fetches the current Steam list and batches, normalizes metadata, encodes with native MPS, scores with two CPU threads, prepares compact imports, and publishes only after integrity and free-plan capacity checks. Encoding and scoring use separate processes to avoid Torch/LightGBM runtime conflicts. Model output is resumable; encoding chunks are keyed by source text and encoder SHA, and ranking journals are bound to input hashes.

Raw Steam responses stay on disk. Genre IDs come from `extra_details.links_and_info.genreids`; ranked tags and review counts come from StoreBrowse. The current app list uses the authenticated free Store API, excluding DLC/software/video/hardware. Existing pages are preserved if games later disappear from the public list. Publisher precedence and Indie genre/tag classification share `scripts/relaunch/catalog.py`.

A capacity check refuses publication if the conservative projected size exceeds the Free budget. It never purchases anything, upgrades an organization, or changes production. A failed generation leaves the last published recommendations serving.
