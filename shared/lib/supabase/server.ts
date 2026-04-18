import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAdminEnv, getSupabaseEnv } from "./env";
import type { Database } from "./types/database";

export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
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
          // Cookie writes can fail when the response is already committed.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnv();

  return createServerClient<Database>(supabaseUrl, supabaseSecretKey, {
    cookies: {
      getAll() {
        return [];
      },
    },
  });
}
