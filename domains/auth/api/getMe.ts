import "server-only";

import type { User } from "@supabase/supabase-js";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";

export async function getMe(): Promise<User | null> {
  const user = await getCurrentUser();
  return user as User | null;
}
