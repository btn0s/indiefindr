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
