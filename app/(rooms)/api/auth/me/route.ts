import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (user == null) {
    return jsonError("User not authenticated", 401);
  }

  return jsonOk({ user });
}
