import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  customType,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Define the custom vector type
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)"; // Match OpenAI text-embedding-3-small dimensions
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
});

// Define the structure for the 'report' column based on your Zod schema
// Note: Drizzle doesn't directly use Zod types for DB columns,
// but this helps document what the jsonb structure should contain.
// We'll store the validated Zod object as JSONB.
import { type DetailedIndieGameReport } from "@/schema"; // Assuming path is correct

export const finds = pgTable(
  "finds",
  {
    id: serial("id").primaryKey(),

    // --- Steam ---
    sourceSteamAppId: text("source_steam_app_id"), // Extracted Steam App ID
    sourceSteamUrl: text("source_steam_url"), // The full Steam URL used for the find
    rawSteamJson: jsonb("raw_steam_json"), // Storing the raw JSON from Steam API (if found)
    hasSteamDemo: boolean("has_steam_demo"), // Storing the raw HTML snippet for demo check (if found)

    // The processed report conforming to DetailedIndieGameReportSchema
    report: jsonb("report").$type<DetailedIndieGameReport>().notNull(),

    // Add the vector column
    vectorEmbedding: vector("vector_embedding"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()) // Auto-update on modification
      .notNull(),
  },
  (table) => {
    return {
      // Add unique index for sourceSteamAppId if it's not null
      sourceSteamAppIdIdx: uniqueIndex("source_steam_app_id_idx")
        .on(table.sourceSteamAppId)
        .where(sql`${table.sourceSteamAppId} IS NOT NULL`),
      // Consider adding an index for vectorEmbedding if you plan to use similarity search
      // vectorEmbeddingIdx: index("vector_embedding_idx").on(table.vectorEmbedding).using("hnsw (vector_embedding vector_l2_ops)") // Example for pgvector
    };
  }
);

// Optional: Define a type for inserting new finds if needed elsewhere
export type NewFind = typeof finds.$inferInsert;
// Optional: Define a type for selecting finds if needed elsewhere
export type SelectFind = typeof finds.$inferSelect;
