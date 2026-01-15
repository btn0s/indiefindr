-- Fix permissions for schema_migrations table
-- This allows Supabase Studio and other tools to query migration history
-- Note: This is read-only access, so it's safe for anon/authenticated roles

GRANT USAGE ON SCHEMA supabase_migrations TO anon, authenticated;
GRANT SELECT ON supabase_migrations.schema_migrations TO anon, authenticated;
