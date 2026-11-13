# Offline catalog ingest

The Mac owns acquisition, encoding, ranking, and publication. Next.js only reads the published data and serves cached pages. No LLM APIs, hosted model APIs, or paid Steam services are involved.

## Current-catalog coverage fix

All 25,555 existing source games have exactly ten distinct indie model targets. The merged model's saved top-200 is already in descending LambdaRank order. Selecting eligible targets before taking ten is equivalent to masking non-indie scores before selection. Every saved list contains at least ten eligible targets, so no alternate model or fallback list is required. LLM rows remain preserved and preferred.

## Full acquisition

Steam currently returns 200,338 game app IDs, rather than the approximately 122k from the handoff. `steam-catalog.py` fetches the entire game list through `IStoreService/GetAppList`, then obtains tags, review counts, descriptions, publishers, developers, assets, prices, and release data in 100-app batches through `IStoreBrowseService/GetItems`.

Genre IDs require `include_extra_details`; they are in `extra_details.links_and_info.genreids`. Existing batches from the initial fetch are supplemented with these details instead of refetching descriptions/assets. Complete responses are versioned on disk. Four I/O workers share a four-request/second limit, respect Retry-After, and retry transient failures. Failed refreshes retain the pending app IDs so a retry cannot lose metadata changes.

`normalize-steam.py` converts raw responses into the established scorer input contracts, stripping BBCode markup from long descriptions. Genre/category names use the original catalog's Steam IDs. The same publisher/Indie classification code is used for the database and model eligibility. Existing catalog pages are retained when the current list cannot return a game. Raw responses never enter Supabase.

## Rebuild and publication

Install the pinned Python environment as described in `scripts/recommender/README.md`. The private data directory contains copies of the saved encoder/ranker and original exports. From the worktree:

```sh
scripts/relaunch/rebuild.sh
```

The pipeline creates a generation directory, acquires and normalizes metadata, encodes with MPS, ranks offline, validates every source's ten recommendations, and publishes only to `rqcqlpoxtdddjcylhopk`. Metadata and scoring stages are sequential. CPU scoring uses two threads. Only one ingest may run at a time.

Publication checks the current organization's plan and database size. It refuses the upload if a conservative projection exceeds the Free entitlement with operating headroom. It cannot upgrade the plan or make purchases. If capacity requires paid hosting, bt must approve the exact quoted plan before any change. The last published catalog remains available when an offline generation fails.

## Reproduction and provenance

The scorer code and parameter snapshot are copied unchanged from the completed merged experiment. The saved ranker has 22 inputs in its original feature order; there is no refitting or model selection. Its Fable feature keeps the global top-200 score normalization across the eligible catalog. Flat-tag and BGE candidate retrieval are restricted to indie targets before the union is ranked.

Encoding chunks are bound to the encoder SHA and exact source text. Ranking journals are bound to catalog, metadata, and ranker hashes, and recover only an interrupted final record. Finished source slates are published to disk atomically. Database model slates are replaced transactionally per source batch, preserving complete lists throughout publication.
