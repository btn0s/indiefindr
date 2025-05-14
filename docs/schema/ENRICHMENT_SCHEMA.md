# Enriched Game Data Schema Design

This document outlines the flexible schema design for enriched game data in IndieFindr. The schema is designed to support rich game data from multiple sources, with a focus on extensibility and performance.

## Overview

The enriched game data schema extends the existing database structure to support:

1. Content from multiple external sources (YouTube, Twitter, Reddit, etc.)
2. Different content types (videos, articles, social posts, etc.)
3. Tagging and categorization of content
4. User interactions with enriched content
5. Relevance scoring and content curation

## Schema Structure

### Content Sources (`content_source`)

Stores information about different content platforms that provide enriched game data.

| Column | Type | Description |
|--------|------|-------------|
| id | bigserial | Primary key |
| name | varchar(100) | Source name (e.g., "YouTube", "Twitter") |
| description | text | Description of the source |
| baseUrl | text | Base URL for the source |
| apiEndpoint | text | API endpoint for fetching data |
| isActive | boolean | Whether the source is active |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |

### Game Enrichment (`game_enrichment`)

The core table that stores enriched content for games.

| Column | Type | Description |
|--------|------|-------------|
| id | bigserial | Primary key |
| gameId | bigint | Reference to external_source.id |
| sourceId | bigint | Reference to content_source.id |
| contentType | varchar(50) | Type of content (video, article, social_post, etc.) |
| title | text | Content title |
| description | text | Content description |
| url | text | URL to the content |
| thumbnailUrl | text | URL to the content thumbnail |
| authorName | text | Name of the content author |
| authorUrl | text | URL to the author's profile |
| publishedAt | timestamp | When the content was published |
| metadata | jsonb | Flexible field for additional metadata |
| embedding | vector(1536) | Vector embedding for semantic search |
| relevanceScore | integer | Score indicating relevance to the game (0-100) |
| isVerified | boolean | Whether the content is verified |
| isFeatured | boolean | Whether the content is featured |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |
| createdBy | uuid | Reference to profiles.id (who added the content) |

### Enrichment Tags (`enrichment_tag`)

Stores tags that can be applied to enriched content.

| Column | Type | Description |
|--------|------|-------------|
| id | bigserial | Primary key |
| name | varchar(100) | Tag name |
| description | text | Tag description |
| category | varchar(50) | Tag category (content_type, mood, etc.) |
| createdAt | timestamp | Creation timestamp |

### Enrichment to Tag (`enrichment_to_tag`)

Junction table for the many-to-many relationship between enrichment and tags.

| Column | Type | Description |
|--------|------|-------------|
| enrichmentId | bigint | Reference to game_enrichment.id |
| tagId | bigint | Reference to enrichment_tag.id |
| createdAt | timestamp | Creation timestamp |

### Enrichment Interaction (`enrichment_interaction`)

Tracks user interactions with enriched content.

| Column | Type | Description |
|--------|------|-------------|
| id | bigserial | Primary key |
| userId | uuid | Reference to profiles.id |
| enrichmentId | bigint | Reference to game_enrichment.id |
| interactionType | varchar(50) | Type of interaction (view, like, share, etc.) |
| metadata | jsonb | Additional interaction data |
| createdAt | timestamp | Creation timestamp |

## Relationships

```
                                 ┌───────────────────┐
                                 │                   │
                                 │  external_source  │
                                 │                   │
                                 └─────────┬─────────┘
                                           │
                                           │ 1:N
                                           │
┌───────────────────┐           ┌─────────▼─────────┐           ┌───────────────────┐
│                   │           │                   │           │                   │
│  content_source   ├───1:N────►│  game_enrichment  │◄────N:1───┤     profiles      │
│                   │           │                   │           │                   │
└───────────────────┘           └─────────┬─────────┘           └───────────────────┘
                                          │                               ▲
                                          │ 1:N                           │
                                          │                               │
                                ┌─────────▼─────────┐                     │
                                │                   │                     │
                                │enrichment_to_tag  │                     │
                                │                   │                     │
                                └─────────┬─────────┘                     │
                                          │                               │
                                          │ N:1                           │
                                          │                               │
                                ┌─────────▼─────────┐           ┌─────────▼─────────┐
                                │                   │           │                   │
                                │  enrichment_tag   │           │enrichment_interact│
                                │                   │           │                   │
                                └───────────────────┘           └───────────────────┘
```

## Indexing Strategy

The schema includes several indexes to optimize common query patterns:

1. **Game-based queries**: Indexes on `game_enrichment.gameId` for efficient retrieval of all enriched content for a specific game.

2. **Content type filtering**: Indexes on `game_enrichment.contentType` and a composite index on `(gameId, contentType)` for filtering content by type.

3. **Relevance-based sorting**: Index on `game_enrichment.relevanceScore` for sorting content by relevance.

4. **Recency-based sorting**: Index on `game_enrichment.publishedAt` for sorting content by publication date.

5. **Tag-based filtering**: Indexes on `enrichment_to_tag.enrichmentId` and `enrichment_to_tag.tagId` for efficient tag-based queries.

6. **User interaction queries**: Indexes on `enrichment_interaction.userId` and `enrichment_interaction.enrichmentId` for user-specific content recommendations.

## Common Access Patterns

1. **Get all enriched content for a game**: Query `game_enrichment` filtered by `gameId`.

2. **Get content of a specific type for a game**: Query `game_enrichment` filtered by `gameId` and `contentType`.

3. **Get featured content**: Query `game_enrichment` filtered by `isFeatured = true`.

4. **Get content with specific tags**: Join `game_enrichment`, `enrichment_to_tag`, and `enrichment_tag` tables.

5. **Get popular content based on user interactions**: Join `game_enrichment` and `enrichment_interaction` tables, aggregating by interaction count.

6. **Search content by title or description**: Query `game_enrichment` with text search on `title` and `description` fields.

7. **Get personalized content recommendations**: Combine user library data with enriched content relevance scores.

## Migration Approach

The migration to the new schema is implemented as an additive change, with no modifications to existing tables. This ensures backward compatibility with existing code.

The migration process:

1. Add new tables to the schema
2. Create database migration scripts
3. Apply migrations to the database
4. Populate initial data for content sources and tags
5. Implement new data access functions
6. Update application code to use the new schema

## Example Queries

See `src/db/examples/enrichment-queries.ts` for example queries that demonstrate common access patterns for the enriched game data schema.

## Test Data

See `src/db/examples/enrichment-seed-data.ts` for scripts to populate the database with test data for the enrichment tables.

