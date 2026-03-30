import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

/** SSR cookie adapter for Route Handlers — uses server-only `SUPABASE_ANON_KEY` for session cookies. */
export async function createRouteHandlerSupabase() {
  const cookieStore = await cookies();
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getServerEnv();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* ignore */
        }
      },
    },
  });
}
