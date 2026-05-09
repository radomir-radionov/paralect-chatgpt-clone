import "server-only";

import { fetchJoinedRooms } from "@domains/chat/room/queries/room-fetchers";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export async function getJoinedRooms() {
  const user = await getCurrentUser();
  if (user == null) {
    throw new Error("Not authenticated");
  }
  const supabase = createSupabaseAdminClient();
  return fetchJoinedRooms(supabase, user.id);
}
