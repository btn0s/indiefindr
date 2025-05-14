import { db } from "@/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { seedAllEnrichmentData } from "@/db/examples/enrichment-seed-data";
import { externalSourceTable } from "@/db/schema";
import { desc } from "drizzle-orm";

/**
 * Script to apply the enrichment migration and seed the database with test data
 * 
 * Usage:
 * npx tsx scripts/apply-enrichment-migration.ts
 */

async function main() {
  try {
    console.log("Applying database migrations...");
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    console.log("Migrations applied successfully!");

    // Get a game ID to use for seeding
    const games = await db
      .select({ id: externalSourceTable.id, title: externalSourceTable.title })
      .from(externalSourceTable)
      .orderBy(desc(externalSourceTable.id))
      .limit(1);

    if (games.length === 0) {
      console.error("No games found in the database. Please add at least one game first.");
      process.exit(1);
    }

    const gameId = games[0].id;
    console.log(`Using game "${games[0].title}" (ID: ${gameId}) for seeding enrichment data.`);

    // Seed the database with test data
    console.log("Seeding enrichment data...");
    const result = await seedAllEnrichmentData(gameId);
    
    console.log("Enrichment data seeded successfully!");
    console.log(`Added ${result.sources.length} content sources`);
    console.log(`Added ${result.tags.length} enrichment tags`);
    console.log(`Added ${result.content.length} enriched content items for game ID ${gameId}`);

    process.exit(0);
  } catch (error) {
    console.error("Error applying migration or seeding data:", error);
    process.exit(1);
  }
}

main();

