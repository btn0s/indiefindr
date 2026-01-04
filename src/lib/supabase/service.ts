import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedServiceClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service role key (bypasses RLS).
 *
 * IMPORTANT: Only import/use this from server-only code (API routes, server actions).
 * Never expose the service role key to the browser.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient {
  if (cachedServiceClient) return cachedServiceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the service role client"
    );
  }

  cachedServiceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedServiceClient;
}

