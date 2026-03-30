"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";

/** Public anon key + URL — Realtime channel subscribe (browser). */
export function getRealtimeSupabase(): SupabaseClient {
  return getBrowserSupabase();
}
