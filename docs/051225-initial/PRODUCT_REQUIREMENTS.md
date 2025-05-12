# Product Requirements Document: IndieFindr (Core Experience)

**Version:** 1.0 (Draft)
**Date:** 2024-07-26
**Author:** btn0s

---

## 1. Introduction & Overview

IndieFindr is conceived as **the human-centric, AI-amplified discovery layer for indie games.** Today, players struggle to find compelling indie titles amidst the overwhelming volume of releases on major platforms like Steam and itch.io. Algorithms often favor mainstream hits, burying unique gems. Developers, in turn, struggle for visibility.

IndieFindr aims to solve this by providing a dedicated space that intelligently surfaces interesting indie games by searching across various sources, enriches them with relevant context (trailers, dev updates, social buzz), and empowers players to curate personal and shared libraries, ultimately leading to frictionless play. The platform indexes games broadly and then applies AI and potentially manual curation to add deeper insights and context over time.

## 2. Goals

*   **Solve the Indie Discovery Problem:** Become the go-to platform for players seeking high-quality, interesting indie games they might otherwise miss.
*   **Foster Engaged Curation:** Enable users to build meaningful personal and group game libraries, transforming discovery into a persistent, valuable activity.
*   **Validate the Core Loop:** Prove the effectiveness of the Discover → Curate → Play → Repeat cycle in driving user engagement and satisfaction.
*   **Build Trust:** Establish IndieFindr as a trusted source through transparent AI and a focus on delivering rich context and quality experiences.

## 3. Target Audience

*   **Indie Game Enthusiasts:** Players who actively seek out unique, non-mainstream gaming experiences but are frustrated with current discovery mechanisms.
*   **Gamers Overwhelmed by Choice:** Players who want curated recommendations and less noise compared to large storefronts.
*   **Social Gamers:** Players who enjoy discovering and discussing games with friends or online communities.

## 4. Core User Experience: The Loop (v0 Focus)

The fundamental user journey for v0 is designed as a continuous loop focused on semantic discovery:

1.  **Discover:** Users primarily engage with discovery via the personalized main feed (`/`). The feed presents **semantically relevant recommendations for new Steam games (based on game embeddings)**. Basic keyword search is available for direct lookups of Steam games.
2.  **Curate:** Users add games they find interesting to their personal library (a simple wishlist in v0). Adding a game can signal interest for future recommendation refinement.
3.  **Play:** From their library or a game detail page, users can easily access the Steam launch link for a game.
4.  **Repeat:** User interactions (library adds) feed back into the system, potentially refining future semantic recommendations.

## 5. Key Features & Functionality (v0 Focus)

*   **Personalized Feed (`/`):** The primary discovery surface, serving semantically relevant Steam game recommendations based on vector embeddings.
*   **Game Detail Pages:** Display basic game information (from Steam) and a link to launch on Steam.
*   **Keyword Search:** Allows users to search indexed Steam games by title keywords.
*   **Personal Library:** A simple wishlist where users can save/remove games.
*   **Steam Data Ingestion & Enrichment:** Processes an initial list of Steam games (from CSV in v0) to fetch metadata and generate embeddings.
*   **Semantic Embedding Generation:** AI component to create vector embeddings from game text data.
*   **Vector Database Integration:** For storing and querying game embeddings for recommendations.

## 6. Design Principles (Experience Pillars - v0 Focus)

*   **Lovable Semantic Discovery:** Prioritize the quality and relevance of AI-driven game recommendations.
*   **Simplicity & Focus:** Deliver the core discovery loop with minimal complexity.
*   **End-to-End Utility:** Ensure users can discover, save, and access a way to play.

## 7. Success Metrics (Product KPIs - v0 Focus)

*   **Core Loop Completion:** Users discovering and saving relevant games.
*   **Recommendation Relevance:** (Qualitative feedback initially, potentially CTR on recommended games later).
*   **User Engagement:** Basic metrics like sessions, library adds.
*   **Retention:** Day 1, Week 1 retention for users finding value in the core discovery.

## 8. Future Considerations (Post-v0)

*   **Automated Crawlers:** Implement crawlers to automatically discover and update games from Steam and other platforms.
*   **Platform Expansion:** Integrate Itch.io, GOG, Game Pass, Epic Games, etc.
*   **Rich Feed Content:** Add granular updates (trailers, tweets, devlogs) to the feed.
*   **"Vibe Check" & Advanced Search:** Natural language search, enhanced filtering, use of sentiment/tags in search.
*   **Deeper AI Insights:** LLM-generated summaries, recommendation explanations, richer taste modeling.
*   **Enhanced Curation:** Library statuses, notes, personal tags, sorting/filtering.
*   **Social/Community Features:** Groups, shared libraries, collaborative tagging, discussions.
*   **Play Tracking & Helper App.**
*   **Broader Content Ingestion:** Developer interviews, articles, etc.
