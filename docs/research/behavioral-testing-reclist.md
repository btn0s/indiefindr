# Behavioral testing beyond aggregate ranking metrics (RecList)

**Theme:** Aggregate metrics on held-out interactions can hide **deployment-specific** failures; behavioral tests target slices and use cases explicitly.

## Source (stable)

| Source | Identifier | Access |
|--------|------------|--------|
| Chia et al., “Beyond NDCG: behavioral testing of recommender systems with RecList” | **arXiv:2111.09963** (v2 revised Mar 2022); same work as ACM DOI below | [arXiv abstract](https://arxiv.org/abs/2111.09963) |
| WWW 2022 proceedings article | ACM DOI [10.1145/3487553.3524215](https://doi.org/10.1145/3487553.3524215) | Crossref title matches arXiv; authors per arXiv API: Chia, Tagliabue, Bianchi, He, Ko |

## Claims (what the paper argues)

- Real-world recommenders need **ad hoc error analysis** and **use-case-specific tests**, not only global NDCG-style numbers on a split.
- RecList organizes evaluation by **task / use case** and supports black-box models.
- The mindset aligns with **slice-based** evaluation: performance on subpopulations or scenarios, not only the average.

## Limits

- RecList’s original demos target classic dataset settings; our “slices” may be **seed type**, storefront tags, or editorial cases—same idea, different schema.
- Behavioral tests still need **human-defined** expectations or oracles for subjective “taste” quality.

## IndieFindr takeaway

- Build a **gold set** with explicit slices (e.g. `avant-garde`, `cozy`, known failure cases from the case study).
- Treat “passes average metric, fails slice X” as a first-class regression—consistent with [`recommendation-evaluation-framework.md`](../recommendation-evaluation-framework.md).

---

Last reviewed: 2026-04-14
