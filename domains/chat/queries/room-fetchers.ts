import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";

export type RoomListItem = {
  id: string;
  name: string;
  memberCount: number;
};

export type RoomDetails = {
  id: string;
  name: string;
};

export async function fetchPublicRooms(
  supabase: SupabaseClient<Database>,
): Promise<RoomListItem[]> {
  const { data, error } = await supabase
    .from("chat_room")
    .select("id, name, chat_room_member (count)")
    .eq("is_public", true)
    .order("name", { ascending: true });

  if (error) return [];

  return data.map((room) => ({
    id: room.id,
    name: room.name,
    memberCount: room.chat_room_member[0]?.count ?? 0,
  }));
}

export async function fetchJoinedRooms(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RoomListItem[]> {
  const { data, error } = await supabase
    .from("chat_room")
    .select("id, name, chat_room_member (member_id)")
    .order("name", { ascending: true });

  if (error) return [];

  return data
    .filter((room) =>
      room.chat_room_member.some((m) => m.member_id === userId),
    )
    .map((room) => ({
      id: room.id,
      name: room.name,
      memberCount: room.chat_room_member.length,
    }));
}

export async function fetchRoom(
  supabase: SupabaseClient<Database>,
  roomId: string,
  userId: string,
): Promise<RoomDetails | null> {
  const { data, error } = await supabase
    .from("chat_room")
    .select("id, name, chat_room_member!inner ()")
    .eq("id", roomId)
    .eq("chat_room_member.member_id", userId)
    .single();

  if (error) return null;
  return { id: data.id, name: data.name };
}
