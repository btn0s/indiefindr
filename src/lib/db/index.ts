import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
// Note: Vercel and Next.js might handle .env.local loading automatically in server environments.
// Adding it here ensures it works consistently, especially for local scripts/workers.
dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

// Check if we're in a build environment (Next.js build time)
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// Only throw an error if we're not in build time
if (!connectionString && !isBuildTime) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

// Configure connection pooling 
const client = connectionString
  ? postgres(connectionString, {
      prepare: false,
      max: 10, // Set maximum number of connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout after 10 seconds
    })
  : ({} as ReturnType<typeof postgres>); // Type assertion for build time

export const db = drizzle(client, { schema });

// Export the schema alongside the db instance for convenience
export { schema };

// Optional: You could also export the client if needed elsewhere, though generally interacting via db is preferred.
// export { client };
