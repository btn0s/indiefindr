import { createClient } from "@supabase/supabase-js";

let cachedBrowserClient: ReturnType<typeof createClient> | null = null;

/**
 * Browser/client Supabase client.
 *
 * Lazily created so builds don't fail when env isn't present.
 */
export function getSupabaseBrowserClient() {
  if (cachedBrowserClient) return cachedBrowserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in environment variables"
    );
  }

  cachedBrowserClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedBrowserClient;
}
