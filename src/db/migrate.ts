import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please check your .env.local file."
  );
}

// Use postgres-js driver for migrations
// Disable prefetch as it might not be supported in all Supabase connection modes
const migrationClient = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(migrationClient);

async function runMigrations() {
  console.log("Starting database migrations using postgres-js driver...");
  try {
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    console.log("Migrations completed successfully.");
    // Important: Close the connection when done
    await migrationClient.end();
    console.log("Migration client closed.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    // Ensure connection is closed even on error
    await migrationClient.end().catch(console.error); // Attempt to close, log if close fails
    process.exit(1);
  }
}

runMigrations();
