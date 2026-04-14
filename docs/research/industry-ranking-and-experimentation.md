# Industry notes: ranking signals, satisfaction, experimentation

**Theme:** Large consumer recommenders combine **many signals**, **long-horizon goals**, and **experimentation**; public posts are not reproducible research but document intent and vocabulary.

These are **not** prescriptions to copy metrics—they are references for **why** CTR-only optimization is risky and how teams talk about evaluation.

## Sources (stable URLs, official)

| Topic | Source | URL |
|-------|--------|-----|
| YouTube: signals beyond click, watch time, surveys | YouTube Blog, Sep 2021 | [On YouTube’s recommendation system](https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/) |
| Netflix: long-term satisfaction framing | Netflix TechBlog | [Recommending for Long-Term Member Satisfaction](https://netflixtechblog.com/recommending-for-long-term-member-satisfaction-at-netflix-ac15cada49ef) |
| Netflix: faster online comparison | Netflix TechBlog | [Interleaving in online experiments](https://netflixtechblog.com/using-interleaving-in-online-experiments-to-accelerate-algorithm-innovation-at-netflix-a04ee392ec55) |
| Netflix: page-level offline simulation | Netflix TechBlog | [Page Simulation for Better Offline Metrics at Netflix](https://netflixtechblog.com/page-simulator-fa02069fb269) |
| YouTube DNN recommendation (candidate generation + ranking) | Covington et al., “Deep Neural Networks for YouTube Recommendations,” RecSys 2016 | [Google Research PDF](https://research.google.com/pubs/archive/45530.pdf) (redirects to `static.googleusercontent.com`; HTTP 200 as of verification) |

## Claims (factual summaries)

- **YouTube (2021 blog):** Describes clicks, watch time, surveys, likes/dislikes, and related signals; argues not all watch time is equally valuable; discusses responsibility layers for some verticals.
- **Netflix (long-term satisfaction):** Public framing of optimizing for member satisfaction over short engagement proxies where they conflict.
- **Netflix (interleaving):** Describes interleaving as a way to compare ranking algorithms with less traffic than standard A/B in some settings.
- **Netflix (page simulator):** Describes offline simulation of page-level outcomes—relevant when the product has **multi-row** surfaces; IndieFindr’s current game-detail slate is simpler.
- **Covington et al. (2016):** Classic reference for two-stage (candidate + ranker) systems and **watch time** as a training objective in one production lineage—not IndieFindr’s architecture, but standard vocabulary.

## Limits

- Blog posts are **high-level**; they do not give reproducible experiments or full metric definitions.
- Our surface is **seed-game slate**, not a full home feed; page simulation is a **future** consideration if the UI grows.

## IndieFindr takeaway

- Use these as **vocabulary and guardrails**: prefer satisfaction-oriented and slice-aware thinking over raw CTR as “match quality.”
- When we have traffic, consider **interleaving-style** comparisons only after metrics and surfaces are defined; **page simulator**-style ideas apply if we ship multi-block recommendation UIs.

---

Last reviewed: 2026-04-14
