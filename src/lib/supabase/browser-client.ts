"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRealtimeClientEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

/**
 * Shared browser Supabase client (`NEXT_PUBLIC_*` anon key) — Realtime subscribe.
 */
export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getRealtimeClientEnv();
  browserClient = createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
