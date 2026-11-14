# Offline review quality

Only Steam-rated targets below 70% are filtered. Titles without a sentiment label (fewer than ten reviews) remain eligible. Game pages remain available regardless of score.

`check-reviews.py` fetches Steam default-filtered histograms offline, with a resumable disk cache and shared rate limit. Daily recent buckets take precedence over overlapping weekly or monthly rollups. A bin needs at least 50 negative votes and at least ten times the median daily negative baseline, normalized by duration. Adjacent anomalous bins merge first. Only merged windows with more negative than positive votes qualify. Both vote polarities are excluded from qualifying windows. No valid residual sample means no rescue.

The existing `review_positive_pct` preserves Steam's actual score. `clean_score`, `bomb_windows` (inclusive Pacific display dates, positive/negative counts, epoch bounds and resolution), and `checked_at` store the offline result. Raw histograms remain on disk. Negative-window detection does not establish motive; page wording stays neutral and links to a game-specific search.

Selection filters existing ranked candidates before taking up to 24 results and applying the existing popularity caps. Archived picks retain eligible games and backfill from the saved model order. No request-time model or LLM inference occurs. The catalog query guards eligibility too. Game-page slates, API, MCP, WebMCP, cards, carousel and CLI share the stored fields.

The nightly pipeline refreshes compact default review summaries even when Steam app modification timestamps do not change, then checks histograms for rated-low games and games with a greater-than-15-point score drop. Install from approved code using `install-nightly.py`; its content-addressed release prevents mutable-checkout downgrades.

Validation covers positive-majority spikes, adjacent-bin merging before dominance, negative-majority rescue, monthly durations, overlap removal, no-data behavior, unrated eligibility, disclosure copy and link safety, real Steam labels, and carousel disclosure. Impact reports compare against the previously deployed 24-row generation via `--old-model-slates`.
