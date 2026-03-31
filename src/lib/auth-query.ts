import type { User } from "@supabase/supabase-js";

export const authMeQueryKey = ["auth", "me"] as const;

export async function fetchAuthMe(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = (await res.json()) as { user: User | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}
