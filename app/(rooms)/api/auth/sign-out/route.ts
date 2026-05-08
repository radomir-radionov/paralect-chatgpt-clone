import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { withSupabaseServerClient } from "@shared/lib/supabase/withSupabaseServerClient";

export const runtime = "nodejs";

export async function POST() {
  return withSupabaseServerClient(async (supabase) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return jsonError(error.message || "Sign-out failed", 500);
    }

    return jsonOk();
  });
}
