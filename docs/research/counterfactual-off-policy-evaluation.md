# Counterfactual and off-policy evaluation (OPE)

**Theme:** Offline metrics on historical clicks are often **observational**; recommendations are **interventional**—what gets shown changes what gets clicked.

## Sources (stable)

| Source | Identifier | Access |
|--------|------------|--------|
| Yan, “Counterfactual Evaluation for Recommendation Systems” | Blog post, Apr 2022 (check byline on page) | [eugeneyan.com](https://eugeneyan.com/writing/counterfactual-evaluation/) |
| Swaminathan & Joachims, “Batch Learning from Logged Bandit Feedback through Counterfactual Risk Minimization” | JMLR, **volume 16** (2015), `swaminathan15a` | [JMLR](https://jmlr.org/papers/v16/swaminathan15a.html) |
| Swaminathan & Joachims, “The Self-Normalized Estimator for Counterfactual Learning” | NeurIPS 2015 (often referred to as **SNIPS** in applied posts) | [NeurIPS proceedings](https://papers.nips.cc/paper_files/paper/2015/hash/39027dfad5138c9ca0c474d71db915c3-Abstract.html) |
| RecSys 2021 Tutorial | “Counterfactual Learning and Evaluation” | [Cornell-hosted tutorial site](https://sites.google.com/cornell.edu/recsys2021tutorial) |
| Open Bandit Dataset / Pipeline | OPE tooling | [GitHub zr-obp](https://github.com/st-tech/zr-obp) (for methodology, not a product dependency) |

## Claims (what the sources argue)

- **Observational vs interventional:** Standard train/validate splits on logs measure fit to **past exposure**, not necessarily outcomes if a **new policy** changed what users see (Yan; tutorial tradition).
- **Inverse propensity scoring (IPS):** Reweight observed rewards by the ratio of new-policy vs logging-policy probability of the shown action; enables “what if” estimates without running an A/B test for every idea—**if** propensities are known and support is adequate.
- **Variance and support:** If the logging policy rarely showed an action, IPS weights explode; SNIPS and related estimators reduce some pathologies; **exploration** in production helps support for new items (Yan; tutorial).
- **Doubly robust (DR):** Combines propensity-based correction with a reward model; common in the OPE literature (tutorial). (Exact DR variant names vary; cite the tutorial or primary paper when making precise claims.)

## Limits

- Public datasets often **lack** propensities; OPE is underused in papers partly for that reason (Yan).
- IndieFindr must **log impressions** (and ideally propensities or randomized slates) before OPE is trustworthy—not a day-one requirement for human slate eval.

## IndieFindr takeaway

- Treat **pairwise human eval** and **offline scorecards** as the main pre-logging stack; add IPS/SNIPS/DR **after** impression logging and exploration design are in place.
- When adding logging, store enough to estimate **P(action | context)** for the logging policy or use controlled exploration.

---

Last reviewed: 2026-04-14
