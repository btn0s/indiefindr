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

## 4. Core User Experience: The Loop

The fundamental user journey is designed as a continuous loop:

1.  **Discover:** Users primarily engage with discovery via the personalized main feed (`/`) or the global search/browse section (`/discover`). The main feed dynamically blends **semantically relevant recommendations for new games (based on game embeddings)** with relevant updates (new content like trailers/tweets) for games already curated by the user, providing ongoing value and re-engagement from v0. The `/discover` section allows for more targeted keyword searching (v0) and browsing across the unified index (initially Steam). AI assists by surfacing relevant titles and providing rich context *for games that have been processed/enriched* (enrichment includes semantic embeddings in v0).
2.  **Curate:** Users add games they find interesting (whether basic or enriched) to their personal library or shared group libraries (groups post-v0). Adding a game can trigger or prioritize its enrichment process (including embedding generation). They can organize these games (e.g., wishlist, playing, finished) and add personal context (notes, tags - future).
3.  **Play:** From their library, users can easily launch a game via deep links to the appropriate store client (Steam, Itch) or cloud gaming service, minimizing friction.
4.  **Repeat:** User interactions (library adds, play activity, ratings - future) feed back into the system, helping prioritize enrichment, improve personalized recommendations, and refine the discovery experience over time.

## 5. Key Features & Functionality

*   **Unified Discovery Interface:**
    *   **Search:** Allows users to search across indexed Steam games (v0) using keywords. (Vision: Evolve search post-v0 to support natural language "vibe check" queries).
    *   **Personalized Feed (`/`):** The primary discovery surface from v0, blending semantically relevant game recommendations (using vector embeddings) with granular content updates (trailers/tweets) for curated games.
    *   **Browsing/Filtering:** Provides ways to explore games (v0 will be basic, evolving with tags/themes post-v0). Discovery features will primarily highlight games with richer, processed context (including generated embeddings).
    *   **Clear Differentiation:** Visually differentiate between games that have full, enriched context available on IndieFindr and those with more basic information awaiting processing, ensuring users understand the level of detail available at a glance.

*   **Context-Rich Game Pages:** (Applies primarily to enriched games)
    *   **Aggregated Media:** Automatically pulls and displays relevant content like official trailers, gameplay videos, and potentially developer diaries/streams (e.g., from YouTube/Twitch).
    *   **Social Buzz:** Surfaces recent, relevant updates or discussions about the game from platforms like Twitter/X.
    *   **Platform & Pricing Info:** Shows where the game can be purchased or played (Steam, itch.io, Game Pass, etc.) and its current price, where available.
    *   **AI-Generated Insights:** Provides concise summaries, potential sentiment analysis, or "hype scores" to give users a quick understanding of the game's reception and profile. (Transparency on how these are generated is key).

*   **Personal Library:**
    *   **Add/Remove Games:** Users can easily add any discovered game (basic or enriched) to their personal library. Adding a basic game signals interest and prioritizes it for enrichment.
    *   **Status Tracking:** Users can mark games with statuses like 'Wishlist', 'Backlog', 'Playing', 'Finished', 'Dropped'.
    *   **(Future) Notes & Tags:** Allow users to add private notes or personal tags to games in their library for better organization.

*   **Low-Friction Play:**
    *   **Direct Launch Links:** Game pages and library entries provide direct links to launch the game via installed clients (e.g., `steam://run/<appid>`) or cloud services (GeForce NOW, xCloud).
    *   **(Future) Optional Playtime Tracking:** A potential desktop helper app could automate launching and track playtime, feeding data back to the user's profile.

*   **(Vision) Group Curation & Social Features:**
    *   **Shared Libraries:** Allow users to create or join groups with shared game libraries/wishlists.
    *   **Collaborative Discovery:** Enable group members to recommend games, vote on tags, and discuss titles within the group space.

*   **(Vision) AI Transparency & Control:**
    *   **Recommendation Explanations:** Briefly explain *why* a game is being recommended (e.g., "Because you liked [Game X]", "Trending in genres you follow").
    *   **Feedback Mechanisms:** Allow users to indicate whether recommendations are relevant, helping to tune the underlying models.

## 6. Design Principles (Experience Pillars)

*   **Prioritize Quality & Context:** Focus on delivering rich, meaningful information; use ranking, filtering, and curated sections to highlight unique and well-contextualized experiences.
*   **Context-rich:** Provide comprehensive, aggregated information to reduce user effort, especially for enriched games.
*   **AI Transparency:** Be clear about how AI is used and provide user controls where feasible.
*   **Social Curation:** Enable collaborative discovery and sharing.
*   **Low-friction Play:** Make the transition from discovery to playing as seamless as possible.

## 7. Success Metrics (Product KPIs)

*   **User Engagement:** Weekly Active Users (WAU), Session Duration, Core Loop Completion Rate (Discover -> Curate -> Play).
*   **Curation Activity:** Games added to libraries per user, Enrichment rate of saved games.
*   **Discovery Effectiveness:** Search success rate (finding intended specific games), Click-through rate on recommendations/discovery modules.
*   **Retention:** User retention rate (Day 1, Week 1, Month 1).
*   **(Future) Play Conversion:** Click-through rate on launch links.
