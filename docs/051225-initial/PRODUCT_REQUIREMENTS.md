# Product Requirements Document: IndieFindr (Core Experience)

**Version:** 1.0 (Draft)
**Date:** 2024-07-26
**Author:** btn0s

---

## 1. Introduction & Overview

IndieFindr is conceived as **the human-centric, AI-amplified discovery layer for indie games.** Today, players struggle to find compelling indie titles amidst the overwhelming volume of releases on major platforms like Steam and itch.io. Algorithms often favor mainstream hits, burying unique gems. Developers, in turn, struggle for visibility.

IndieFindr aims to solve this by providing a dedicated space that intelligently surfaces interesting indie games, enriches them with relevant context (trailers, dev updates, social buzz), and empowers players to curate personal and shared libraries, ultimately leading to frictionless play.

## 2. Goals

*   **Solve the Indie Discovery Problem:** Become the go-to platform for players seeking high-quality, interesting indie games they might otherwise miss.
*   **Foster Engaged Curation:** Enable users to build meaningful personal and group game libraries, transforming discovery into a persistent, valuable activity.
*   **Validate the Core Loop:** Prove the effectiveness of the Discover → Curate → Play → Repeat cycle in driving user engagement and satisfaction.
*   **Build Trust:** Establish IndieFindr as a trusted source through transparent AI and a focus on quality over quantity (the "Indie-first" principle).

## 3. Target Audience

*   **Indie Game Enthusiasts:** Players who actively seek out unique, non-mainstream gaming experiences but are frustrated with current discovery mechanisms.
*   **Gamers Overwhelmed by Choice:** Players who want curated recommendations and less noise compared to large storefronts.
*   **Social Gamers:** Players who enjoy discovering and discussing games with friends or online communities.

## 4. Core User Experience: The Loop

The fundamental user journey is designed as a continuous loop:

1.  **Discover:** Users search or browse through a blend of curated, high-quality indie titles ("On IndieFindr") and a broader index of games from external platforms (Steam, itch.io, etc.). AI assists by surfacing relevant titles and providing context.
2.  **Curate:** Users add games they find interesting to their personal library or shared group libraries. They can organize these games (e.g., wishlist, playing, finished) and add personal context (notes, tags - future).
3.  **Play:** From their library, users can easily launch a game via deep links to the appropriate store client (Steam, Itch) or cloud gaming service, minimizing friction.
4.  **Repeat:** User interactions (library adds, play activity, ratings - future) feed back into the system, improving personalized recommendations and refining the discovery experience over time.

## 5. Key Features & Functionality

*   **Unified Discovery Interface:**
    *   **Search:** Allows users to search across all indexed games (curated and external).
    *   **Browsing/Filtering:** Provides ways to explore games, potentially through genres, tags, themes, or AI-driven categories (e.g., "Hidden Gems," "Trending Among Friends").
    *   **Clear Distinction:** Visually differentiate between games formally part of IndieFindr's curated selection and those indexed from external sources, while allowing both to be explored.

*   **Context-Rich Game Pages:**
    *   **Aggregated Media:** Automatically pulls and displays relevant content like official trailers, gameplay videos, and potentially developer diaries/streams (e.g., from YouTube/Twitch).
    *   **Social Buzz:** Surfaces recent, relevant updates or discussions about the game from platforms like Twitter/X.
    *   **Platform & Pricing Info:** Shows where the game can be purchased or played (Steam, itch.io, Game Pass, etc.) and its current price, where available.
    *   **AI-Generated Insights:** Provides concise summaries, potential sentiment analysis, or "hype scores" to give users a quick understanding of the game's reception and profile. (Transparency on how these are generated is key).

*   **Personal Library:**
    *   **Add/Remove Games:** Users can easily add any discovered game (curated or external) to their personal library.
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

*   **Indie-first:** Prioritize quality and unique experiences; clearly distinguish curated content.
*   **Context-rich:** Provide comprehensive, aggregated information to reduce user effort.
*   **AI Transparency:** Be clear about how AI is used and provide user controls where feasible.
*   **Social Curation:** Enable collaborative discovery and sharing.
*   **Low-friction Play:** Make the transition from discovery to playing as seamless as possible.

## 7. Success Metrics (Product KPIs)

*   **User Engagement:** Weekly Active Users (WAU), Session Duration, Core Loop Completion Rate (Discover -> Curate -> Play).
*   **Curation Activity:** Games added to libraries per user, Ratio of Curated vs. External games added.
*   **Discovery Effectiveness:** Search success rate, Click-through rate on recommendations.
*   **Retention:** User retention rate (Day 1, Week 1, Month 1).
*   **(Future) Play Conversion:** Click-through rate on launch links.
