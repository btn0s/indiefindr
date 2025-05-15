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
  pgEnum,
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

export const gameEnrichmentContentTypeEnum = pgEnum(
  "game_enrichment_content_type",
  [
    "description",
    "review_snippet",
    "video_url",
    "image_url",
    "article_url",
    "social_post_url",
    "game_feature",
    "system_requirements",
    "tag",
    "genre",
  ]
);

export const gameEnrichmentStatusEnum = pgEnum("game_enrichment_status", [
  "active",
  "inactive",
  "pending_review",
  "rejected",
]);

export const gameOverallEnrichmentStatusEnum = pgEnum(
  "game_overall_enrichment_status",
  ["pending", "in_progress", "partial", "enriched", "failed"]
);

export const gamesTable = pgTable(
  "games",
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
    enrichmentStatus: gameOverallEnrichmentStatusEnum("enrichment_status")
      .default("pending")
      .notNull(),
    isFeatured: boolean("is_featured").default(false),
    steamAppid: text("steam_appid").unique(),
    lastFetched: timestamp("last_fetched", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    foundBy: uuid("found_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => {
    return {
      externalIdIdx: index("idx_games_external_id").on(table.externalId),
      enrichmentStatusIdx: index("idx_games_enrichment_status").on(
        table.enrichmentStatus
      ),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    gameRefId: bigint("game_ref_id", { mode: "number" })
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.gameRefId] }),
      userIdIdx: index("idx_library_user_id").on(table.userId),
    };
  }
);

export const gameEnrichmentTable = pgTable(
  "game_enrichment",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    gameId: bigint("game_id", { mode: "number" })
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    sourceSpecificId: text("source_specific_id"),
    contentType: gameEnrichmentContentTypeEnum("content_type").notNull(),
    contentValue: text("content_value"),
    contentJson: jsonb("content_json"),
    language: text("language").default("en"),
    region: text("region"),
    priority: bigint("priority", { mode: "number" }),
    status: gameEnrichmentStatusEnum("status").default("active").notNull(),
    sourceUrl: text("source_url"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    submittedBy: uuid("submitted_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => {
    return {
      gameIdContentTypeSourceIdx: index(
        "idx_game_enrichment_game_id_content_type_source_name"
      ).on(table.gameId, table.contentType, table.sourceName),
      gameIdIdx: index("idx_game_enrichment_game_id").on(table.gameId),
      contentTypeIdx: index("idx_game_enrichment_content_type").on(
        table.contentType
      ),
      contentTypeLangRegionIdx: index(
        "idx_game_enrichment_content_type_lang_region"
      ).on(table.contentType, table.language, table.region),
    };
  }
);
