import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable not found. Check .env.local"
  );
}

// Client for regular serverless functions (not edge)
// It's important to use a connection pool for serverless functions
// that might handle concurrent requests. `postgres` handles pooling.
// We disable prepare statements as recommended for Supabase pooler.
const client = postgres(connectionString, { prepare: false });

// Initialize Drizzle
export const db = drizzle(client, { schema });

// Export the schema along with the db instance
export { schema };
