import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

/** Service-role client. Use only in API routes / server-only code. */
export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
