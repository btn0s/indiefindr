import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Check if we're in a build environment (Next.js build time)
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// Cache to store clients by cookie header string
const clientCache = new Map();

export const createClient = async () => {
  // During build time, return a mock client to avoid errors
  if (isBuildTime) {
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
      // Add other mock methods as needed
    } as any;
  }

  const cookieStore = await cookies();

  // Create a cache key based on all cookie values
  // This ensures we create new clients when cookies change (e.g., on auth state changes)
  const cookieKey = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join(";");

  // Return cached client if it exists for these cookies
  if (clientCache.has(cookieKey)) {
    return clientCache.get(cookieKey);
  }

  // Create new client if not in cache
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  // Store in cache
  clientCache.set(cookieKey, client);

  // Limit cache size to prevent memory leaks
  if (clientCache.size > 100) {
    const oldestKey = clientCache.keys().next().value;
    clientCache.delete(oldestKey);
  }

  return client;
};
