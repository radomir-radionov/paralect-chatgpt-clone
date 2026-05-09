import "server-only";

import type { RoomDetails } from "@domains/chat/room/queries/room-fetchers";
import { fetchRoom } from "@domains/chat/room/queries/room-fetchers";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { getSupabaseAdminClient } from "@shared/lib/supabase/server";

/**
 * Fetches the room server-side. Returns `null` when the room does not exist
 * (404) or when access is denied — mirrors `clientGetRoom`.
 */
export async function getRoom(roomId: string): Promise<RoomDetails | null> {
  const user = await getCurrentUser();
  if (user == null) return null;
  const supabase = getSupabaseAdminClient();
  return fetchRoom(supabase, roomId, user.id);
}
