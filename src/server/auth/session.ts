import { createServerClient } from "@supabase/ssr";
import { parse } from "cookie";
import type { User } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

function cookiesFromHeader(header: string | null) {
  const raw = parse(header ?? "");
  return Object.entries(raw).map(([name, value]) => ({
    name,
    value: value ?? "",
  }));
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getServerEnv();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookiesFromHeader(request.headers.get("cookie"));
      },
      setAll() {
        /* Session refresh: handled by middleware for document requests */
      },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireUser(request: Request): Promise<User> {
  const user = await getUserFromRequest(request);
  if (!user) {
    const err = new Error("Unauthorized") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  return user;
}
