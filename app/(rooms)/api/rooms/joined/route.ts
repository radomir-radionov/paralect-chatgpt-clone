import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { getSupabaseAdminClient } from "@shared/lib/supabase/server";
import { fetchJoinedRooms } from "@domains/chat/room/queries/room-fetchers";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (user == null) {
    return jsonError("User not authenticated", 401);
  }

  const supabase = getSupabaseAdminClient();

  try {
    const rooms = await fetchJoinedRooms(supabase, user.id);
    return jsonOk({ rooms });
  } catch (error) {
    console.error("[api/rooms/joined]", error);
    return jsonError("Internal server error", 500);
  }
}
