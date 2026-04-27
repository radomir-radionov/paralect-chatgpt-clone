import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";

export type RoomListItem = {
  id: string;
  name: string;
  modelSlug: string;
  lastMessageAt: string;
};

export type RoomDetails = {
  id: string;
  name: string;
  modelSlug: string;
};

export async function fetchJoinedRooms(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RoomListItem[]> {
  const { data, error } = await supabase
    .from("chat_room")
    .select("id, name, model_slug, last_message_at")
    .eq("owner_id", userId)
    .order("last_message_at", { ascending: false });

  if (error) return [];

  return data.map((room) => ({
    id: room.id,
    name: room.name,
    modelSlug: room.model_slug,
    lastMessageAt: room.last_message_at,
  }));
}

export async function fetchRoom(
  supabase: SupabaseClient<Database>,
  roomId: string,
  userId: string,
): Promise<RoomDetails | null> {
  const { data, error } = await supabase
    .from("chat_room")
    .select("id, name, model_slug")
    .eq("id", roomId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) return null;
  if (data == null) return null;
  return { id: data.id, name: data.name, modelSlug: data.model_slug };
}
