import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
// Note: Vercel and Next.js might handle .env.local loading automatically in server environments.
// Adding it here ensures it works consistently, especially for local scripts/workers.
dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

// Disable prefetch as it is not supported for "Transaction" pool mode
// See: https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-drizzle
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

// Export the schema alongside the db instance for convenience
export { schema };

// Optional: You could also export the client if needed elsewhere, though generally interacting via db is preferred.
// export { client };
