import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

export const createClient = async () => {
  // Mark this function as having no static result to avoid the dynamic server usage error
  noStore();

  try {
    // Get cookie store
    const cookieStore = await cookies();

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
          remove(name) {
            try {
              cookieStore.delete(name);
            } catch {
              // The `remove` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    );
  } catch (e) {
    // Fallback for static rendering contexts
    console.warn("Creating fallback Supabase client");
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {},
        },
      }
    );
  }
};
