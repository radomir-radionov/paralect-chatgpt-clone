import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";

export type UserProfile = {
  id: string;
  name: string;
  image_url: string | null;
};

export async function fetchProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select("id, name, image_url")
    .eq("id", userId)
    .limit(1);

  if (error) return null;
  return data?.[0] ?? null;
}
