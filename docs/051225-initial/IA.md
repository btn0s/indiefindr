# Information Architecture (Sitemap) - IndieFindr

This document outlines the primary sections and routes for the IndieFindr web application, based on the initial specification.

## Main Navigation / Core Sections

*   **`/` (Home / Feed)**
    *   **Purpose:** Personalized, dynamic feed acting as the primary discovery surface. Blends AI-driven recommendations for new games, relevant updates/content for games in the user's library (e.g., new trailers, devlogs, social buzz), and potentially other highlighted content snippets.
    *   **Target Audience:** Logged-in users.
    *   **Key Components:** Algorithmically blended feed cards showing new recommendations, updates on curated games, featured content.

*   **`/discover` (Discover)**
    *   **Purpose:** Global search and browsing interface for the unified index of games from all sources.
    *   **Target Audience:** All users (logged-in and anonymous).
    *   **Key Components:** Search bar, filters (genre, tags, platform), results display (differentiating enriched vs. basic results), AI-driven recommendations primarily featuring enriched games.

*   **`/groups` (Groups - Hub)**
    *   **Purpose:** Entry point for accessing user's group memberships.
    *   **Target Audience:** Logged-in users.
    *   **Key Components:** List of groups the user belongs to.

*   **`/profile` (Profile)**
    *   **Purpose:** User settings, view personal library/stats, manage connections.
    *   **Target Audience:** Logged-in users.
    *   **Key Components:** Settings management, personal game library overview, playtime stats (if helper app used).

## Detail / Functional Routes

*   **`/game/[slug]` (Game Detail)**
    *   **Purpose:** Detailed view of a specific game. Shows enriched information (trailers, devlogs, social buzz, platforms, price). Uses ISR with partial prerendering for performance.
    *   **Target Audience:** All users.
    *   **Key Components:** Game summary, media gallery, AI context, platform/price grid, curation actions (add to library/group - logged-in only), notes/tags (logged-in only).

*   **`/groups/[id]` (Specific Group)**
    *   **Purpose:** Dedicated space for a specific group, likely containing sub-sections for shared discovery and library management within that group.
    *   **Target Audience:** Logged-in members of the specific group.
    *   **Key Components:** Group member list, shared game library, group-specific discovery/recommendations, real-time updates. Potentially includes nested routes like `/groups/[id]/library` or `/groups/[id]/discover`.

*   **`/play/[gameId]` (Launch Helper)**
    *   **Purpose:** Intermediate page to facilitate launching a game via deep links or cloud services. May interact with the optional desktop helper app.
    *   **Target Audience:** Logged-in users attempting to play a game from their library.
    *   **Key Components:** Launch links (Steam, Itch, Cloud, etc.), status indicator, instructions for helper app interaction.

## Authentication Routes (Implicit - Likely under `/auth` or similar)

*   **Sign In:** Standard login page.
*   **Sign Up:** User registration page.
*   **Forgot Password:** Password recovery flow.
*   **Reset Password:** Page to set a new password via token.
*   **Auth Callback:** Handles redirects from OAuth providers (e.g., Google, Discord).

## Future / Potential Routes

*   Routes related to developer interactions (if planned).
*   Admin/Moderation interfaces.

This structure is based on the `SPEC.md` v. 051225 and may evolve as the project progresses. 