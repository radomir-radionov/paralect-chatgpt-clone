import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { createSupabaseServerClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return jsonError(error.message || "Sign-out failed", 500);
  }

  return jsonOk();
}
