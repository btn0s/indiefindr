import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({
  path: ".env.local", // Make sure Drizzle Kit can find your Supabase URL
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL or Anon Key not found in environment variables."
  );
}

// IMPORTANT: For migrations, Drizzle Kit needs the *database* URL,
// which usually includes the password. Supabase provides a
// specific connection string for this purpose.
// Find it in your Supabase Project: Settings -> Database -> Connection string (URI tab)
// It will look like: postgresql://postgres:[YOUR-PASSWORD]@[cloud-provider].supabase.co:[port]/postgres
// Add this full connection string to your .env.local as DATABASE_URL
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn(
    "DATABASE_URL environment variable not found. Please add the full Postgres connection string from Supabase Database settings to .env.local for migrations."
  );
  throw new Error("DATABASE_URL is required for Drizzle Kit migrations.");
}

export default defineConfig({
  schema: "./src/db/schema.ts", // Path to your schema file
  out: "./src/db/migrations", // Directory to store migration files
  dialect: "postgresql", // Specify PostgreSQL dialect
  dbCredentials: {
    url: dbUrl, // Use the full database connection string
  },
  verbose: true, // Optional: Logs more details during migrations
  strict: true, // Optional: Makes Drizzle Kit stricter about potential issues
});
