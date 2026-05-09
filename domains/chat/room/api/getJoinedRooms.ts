import "server-only";

import { fetchJoinedRooms } from "@domains/chat/room/queries/room-fetchers";
import { getSupabaseAdminClient } from "@shared/lib/supabase/server";

export async function getJoinedRooms(userId: string) {
  const supabase = getSupabaseAdminClient();
  return fetchJoinedRooms(supabase, userId);
}
