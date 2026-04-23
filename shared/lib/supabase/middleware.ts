import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./env";
import type { Database } from "./types/database";

/** Mutable holder so `setAll` can replace the outgoing response (Supabase SSR pattern). */
export type MiddlewareResponseState = { response: NextResponse };

/**
 * Supabase client for the Next.js request boundary (proxy/middleware).
 * Uses `NextRequest` / `NextResponse` cookies — not `cookies()` from `next/headers`.
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  state: MiddlewareResponseState,
) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        state.response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          state.response.cookies.set(name, value, options);
        });
      },
    },
  });
}
