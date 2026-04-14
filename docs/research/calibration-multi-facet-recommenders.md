# Calibration and multi-facet interests

**Theme:** When users have several kinds of taste, optimizing only top-item relevance can **under-represent** minority facets in a whole list.

## Sources (stable)

| Source | Identifier | Access |
|--------|------------|--------|
| Steck, “Calibrated Recommendations” | RecSys 2018, DOI [10.1145/3240323.3240372](https://doi.org/10.1145/3240323.3240372) | ACM |
| Abdollahpouri et al., “Calibrated Recommendations as a Minimum-Cost Flow Problem” | WSDM 2023; [Spotify Research publication page](https://research.atspotify.com/publications/calibrated-recommendations-as-a-minimum-cost-flow-problem/) | Spotify Research |
| Spotify Research (blog-style article) | [Users’ interests are multi-faceted…](https://research.atspotify.com/2023/02/users-interests-are-multi-faceted-recommendation-models-should-be-too/) (Feb 2023) | Spotify Research |
| Anderson et al., “Algorithmic Effects on the Diversity of Consumption on Spotify” | WWW 2020; [PDF on author site](https://www.cs.toronto.edu/~ashton/pubs/alg-effects-spotify-www2020.pdf) | Research paper (first author: Ashton Anderson) |

## Claims (what the sources argue)

- **Calibration (Steck):** A good list should reflect the **mix** of a user’s interests (e.g. genre or category proportions), not only maximize per-item relevance—otherwise dominant interests crowd out the rest.
- **Multi-facet framing (Spotify article):** Users are not single-topic; recommendation lists should **represent multiple facets** proportionally, not only the strongest signal.
- **Minimum-cost flow (WSDM 2023):** One algorithmic approach to trade off relevance vs miscalibration; empirical comparisons use standard ranking metrics plus calibration measures.
- **Consumption diversity (WWW 2020):** Large-scale study on Spotify finding, among other results, that **algorithmically driven listening through recommendations is associated with reduced consumption diversity** (within their embedding-based diversity measure), while higher diversity correlates with long-term outcomes such as conversion and retention—useful when arguing that short-term relevance alone is not the whole story.

## Limits

- These papers assume **logged user history** or explicit category structure; IndieFindr’s current surface is largely **seed-game → slate**, not a full user profile.
- “Calibration” for us may first mean **seed-to-slate** or **brief-to-slate** facet coverage, not Steck-style profile-to-list proportions until we have reliable user signals.

## IndieFindr takeaway

- Use calibration **language** to explain why a slate that is “all the same subgenre” can be wrong even if each item scores well on one axis.
- When we add taste briefs or profiles, revisit Steck-style calibration explicitly in the eval framework.

---

Last reviewed: 2026-04-14
