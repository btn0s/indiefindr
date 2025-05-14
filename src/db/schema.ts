import {
  bigserial,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
  primaryKey,
  uuid,
  bigint,
  customType,
  pgTable,
  integer,
  varchar,
} from "drizzle-orm/pg-core";

// Define custom type for vector
const vector = (name: string, dimensions: number) =>
  customType<{
    data: number[];
    driverData: string;
    config: { dimensions: number };
  }>({
    dataType(config) {
      return `vector(${config?.dimensions ?? dimensions})`;
    },
    toDriver(value: number[]): string {
      return JSON.stringify(value);
    },
    fromDriver(value: unknown): number[] {
      if (typeof value !== "string") {
        throw new Error("Expected string from driver");
      }
      return JSON.parse(value);
    },
  })(name, { dimensions });

// Table to store content sources (YouTube, Twitter, Reddit, etc.)
export const contentSourceTable = pgTable(
  "content_source",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    baseUrl: text("base_url"),
    apiEndpoint: text("api_endpoint"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => {
    return {
      nameIdx: index("idx_content_source_name").on(table.name),
    };
  }
);

// Table to store enriched game data from various sources
export const gameEnrichmentTable = pgTable(
  "game_enrichment",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    gameId: bigint("game_id", { mode: "number" })
      .notNull()
      .references(() => externalSourceTable.id, { onDelete: "cascade" }),
    sourceId: bigint("source_id", { mode: "number" })
      .notNull()
      .references(() => contentSourceTable.id, { onDelete: "cascade" }),
    contentType: varchar("content_type", { length: 50 }).notNull(), // video, article, social_post, etc.
    title: text("title"),
    description: text("description"),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    authorName: text("author_name"),
    authorUrl: text("author_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    metadata: jsonb("metadata"), // Flexible field for additional metadata
    embedding: vector("embedding", 1536), // For semantic search
    relevanceScore: integer("relevance_score"), // 0-100 score for relevance to the game
    isVerified: boolean("is_verified").default(false), // Flag for verified content
    isFeatured: boolean("is_featured").default(false), // Flag for featured content
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => {
    return {
      gameIdIdx: index("idx_game_enrichment_game_id").on(table.gameId),
      sourceIdIdx: index("idx_game_enrichment_source_id").on(table.sourceId),
      contentTypeIdx: index("idx_game_enrichment_content_type").on(table.contentType),
      relevanceScoreIdx: index("idx_game_enrichment_relevance_score").on(table.relevanceScore),
      publishedAtIdx: index("idx_game_enrichment_published_at").on(table.publishedAt),
      // Composite index for game + content type for efficient filtering
      gameContentTypeIdx: index("idx_game_enrichment_game_content_type").on(
        table.gameId,
        table.contentType
      ),
    };
  }
);

// Table for user interactions with enriched content
export const enrichmentInteractionTable = pgTable(
  "enrichment_interaction",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    enrichmentId: bigint("enrichment_id", { mode: "number" })
      .notNull()
      .references(() => gameEnrichmentTable.id, { onDelete: "cascade" }),
    interactionType: varchar("interaction_type", { length: 50 }).notNull(), // view, like, share, save, etc.
    metadata: jsonb("metadata"), // Additional interaction data
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.enrichmentId, table.interactionType] }),
      userIdIdx: index("idx_enrichment_interaction_user_id").on(table.userId),
      enrichmentIdIdx: index("idx_enrichment_interaction_enrichment_id").on(table.enrichmentId),
      interactionTypeIdx: index("idx_enrichment_interaction_type").on(table.interactionType),
    };
  }
);

// Table for tagging enriched content
export const enrichmentTagTable = pgTable(
  "enrichment_tag",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    category: varchar("category", { length: 50 }), // For grouping tags (e.g., content type, mood, etc.)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      nameIdx: index("idx_enrichment_tag_name").on(table.name),
      categoryIdx: index("idx_enrichment_tag_category").on(table.category),
    };
  }
);

// Junction table for many-to-many relationship between enrichment and tags
export const enrichmentToTagTable = pgTable(
  "enrichment_to_tag",
  {
    enrichmentId: bigint("enrichment_id", { mode: "number" })
      .notNull()
      .references(() => gameEnrichmentTable.id, { onDelete: "cascade" }),
    tagId: bigint("tag_id", { mode: "number" })
      .notNull()
      .references(() => enrichmentTagTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.enrichmentId, table.tagId] }),
      enrichmentIdIdx: index("idx_enrichment_to_tag_enrichment_id").on(table.enrichmentId),
      tagIdIdx: index("idx_enrichment_to_tag_tag_id").on(table.tagId),
    };
  }
);

export const externalSourceTable = pgTable(
  "external_source",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    platform: text("platform").default("steam").notNull(),
    externalId: text("external_id").notNull().unique(),
    title: text("title"),
    developer: text("developer"),
    descriptionShort: text("description_short"),
    descriptionDetailed: text("description_detailed"),
    genres: text("genres").array(),
    tags: text("tags").array(),
    embedding: vector("embedding", 1536), // For text-embedding-3-small
    rawData: jsonb("raw_data"),
    enrichmentStatus: text("enrichment_status").default("pending").notNull(),
    isFeatured: boolean("is_featured").default(false),
    steamAppid: text("steam_appid").unique(),
    lastFetched: timestamp("last_fetched", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    foundBy: uuid("found_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }), // Added to track who submitted the game
  },
  (table) => {
    return {
      externalIdIdx: index("idx_external_source_external_id").on(
        table.externalId
      ),
      // titleIdx: index('idx_external_source_title').on(table.title).using('gin'), // Requires custom GIN index setup or use a different approach for FTS with Drizzle
      enrichmentStatusIdx: index("idx_external_source_enrichment_status").on(
        table.enrichmentStatus
      ),
      // embeddingIdx: index('idx_external_source_embedding').on(table.embedding).using('ivfflat', { ops: 'vector_cosine_ops', lists: 100 }), // Requires extension and specific index type
    };
  }
);

// Add the profiles table first so it can be referenced by libraryTable
export const profilesTable = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // No reference to authUsersTable - managed by trigger/FK in database
    username: text("username").unique().notNull(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      usernameIdx: index("idx_profiles_username").on(table.username),
    };
  }
);

export const libraryTable = pgTable(
  "library",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }), // Now referencing profiles table instead of auth users
    gameRefId: bigint("game_ref_id", { mode: "number" })
      .notNull()
      .references(() => externalSourceTable.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.gameRefId] }),
      userIdIdx: index("idx_library_user_id").on(table.userId),
    };
  }
);
