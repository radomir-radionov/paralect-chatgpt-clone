import "server-only";

import type { UserProfile } from "@domains/auth/queries/profile-fetcher";
import { fetchProfile } from "@domains/auth/queries/profile-fetcher";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { getSupabaseAdminClient } from "@shared/lib/supabase/server";

export async function getMyProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (user == null) return null;
  const supabase = getSupabaseAdminClient();
  return fetchProfile(supabase, user.id);
}
