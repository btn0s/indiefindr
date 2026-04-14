# Research briefs (drift-resistant)

This folder holds **external** research and industry references used to inform recommendation evaluation at IndieFindr. It is separate from product docs like [`recommendation-evaluation-framework.md`](../recommendation-evaluation-framework.md) so we can update product guidance without rewriting citations.

## What “drift-free” means here

- **Stable identifiers first**: arXiv IDs (`arXiv:2111.09963`), DOIs, or long-lived publisher URLs—not social reposts or SEO blogs as primary sources.
- **One brief per theme**: small files that state claims, limits, and how they apply to us—no sprawling link dumps.
- **Last reviewed**: each brief ends with `Last reviewed` (YYYY-MM-DD). Re-read when the topic materially affects eval design.
- **Facts vs product**: “What the source says” is separated from “What we do in IndieFindr” to avoid mixing research with roadmap.

## Index

| Brief | Topic |
|-------|--------|
| [calibration-multi-facet-recommenders.md](./calibration-multi-facet-recommenders.md) | Calibration, multi-facet interests, relevance vs list-level fairness to the user’s mix |
| [counterfactual-off-policy-evaluation.md](./counterfactual-off-policy-evaluation.md) | Offline eval as interventional; IPS/SNIPS/DR; exposure bias; when OPE is viable |
| [behavioral-testing-reclist.md](./behavioral-testing-reclist.md) | Behavioral / slice-based testing beyond aggregate ranking metrics |
| [industry-ranking-and-experimentation.md](./industry-ranking-and-experimentation.md) | Public writeups: signals, long-term satisfaction, interleaving, page-level simulation |

## How to add a new brief

1. Pick a **single** theme (one paper cluster or one official post series).
2. Use the same section template as existing briefs: Sources, Claims (factual), Limits, IndieFindr takeaway, Last reviewed.
3. Prefer primary sources; if only secondary summaries exist, label them as such.

## Verification notes

Spot-checks (not a substitute for reading originals):

| Date | What was checked |
|------|------------------|
| 2026-04-14 | **Crossref** `10.1145/3240323.3240372`: title “Calibrated recommendations,” author Harald Steck. |
| 2026-04-14 | **Crossref** `10.1145/3487553.3524215`: title matches RecList; authors Chia, Tagliabue, Bianchi, He, Ko. **arXiv API** `2111.09963`: same title, lists `arxiv:doi` to that DOI. |
| 2026-04-14 | **WWW 2020 PDF** (Toronto author mirror): title and authors Anderson et al. (not “Agarwal”). |
| 2026-04-14 | **HTTP**: `research.google.com/pubs/archive/45530.pdf` → 200 after redirect. **ACM DOI** pages may return 403 to automated clients; DOI still resolves for browsers. |

Corrected in docs after this pass: wrong surname for WWW 2020 paper; RecList author line; vague SNIPS/JMLR row; sharper claim for Anderson et al. findings.
