# Offline review quality

Only Steam-rated targets below 70% are filtered. Titles without a sentiment label (fewer than ten reviews) remain eligible. Game pages remain available regardless of score.

`check-reviews.py` runs the review-bomb model described in [review-bomb-detection.md](review-bomb-detection.md): histograms find sentiment breaks against a robust trailing baseline, GetAppReviews supplies window counts in the headline score's own population plus per-review evidence, and each window gets a verdict (bomb, active bomb, decline, Steam-flagged, unresolved) and a reason. Only bombs and active bombs (strong evidence while still open) adjust `clean_score`; declines and Steam-flagged periods never do, and unresolved open windows are shown without adjusting. Open windows are re-judged every nightly run. No valid residual sample means no rescue.

The existing `review_positive_pct` preserves Steam's actual score. `clean_score`, `bomb_windows` (inclusive Pacific display dates, histogram and headline-population counts, epoch bounds, resolution, verdict and reason), and `checked_at` store the offline result. Raw histograms remain on disk. Negative-window detection does not establish motive; page wording stays neutral and links to a game-specific search.

Selection filters existing ranked candidates before taking up to 24 results and applying the existing popularity caps. Archived picks retain eligible games and backfill from the saved model order. No request-time model or LLM inference occurs. The catalog query guards eligibility too. Game-page slates, API, MCP, WebMCP, cards, carousel and CLI share the stored fields.

The nightly pipeline refreshes compact default review summaries even when Steam app modification timestamps do not change, then checks histograms for rated-low games and games with a greater-than-15-point score drop. Install from approved code using `install-nightly.py`; its content-addressed release prevents mutable-checkout downgrades.

Validation covers positive-majority spikes, adjacent-bin merging before dominance, negative-majority rescue, monthly durations, overlap removal, no-data behavior, unrated eligibility, disclosure copy and link safety, real Steam labels, and carousel disclosure. Impact reports compare against the previously deployed 24-row generation via `--old-model-slates`.
