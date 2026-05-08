import { fetchProfile } from "@domains/auth/queries/profile-fetcher";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (user == null) {
    return jsonError("User not authenticated", 401);
  }

  const supabase = createSupabaseAdminClient();
  const profile = await fetchProfile(supabase, user.id);

  if (profile == null) {
    return jsonError("Profile not found", 404);
  }

  return jsonOk({ profile });
}
