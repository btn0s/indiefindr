import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" }); // Load .env.local for credentials

export default defineConfig({
  dialect: "postgresql", // Specify the dialect
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    // Use environment variables for Supabase connection string
    url: process.env.DATABASE_DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});
