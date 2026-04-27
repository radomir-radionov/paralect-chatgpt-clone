import { fetchApiOk } from "@shared/lib/http/fetchApiOk";

import type { MessagesPage } from "./message-fetchers";
import type { RoomDetails, RoomListItem } from "./room-fetchers";

export async function clientGetJoinedRooms(): Promise<RoomListItem[]> {
  const data = await fetchApiOk<{ rooms: RoomListItem[] }>("/api/rooms/joined", {
    method: "GET",
    cache: "no-store",
  });
  return data.rooms;
}

export async function clientGetRoom(roomId: string): Promise<RoomDetails | null> {
  const res = await fetch(`/api/rooms/${roomId}`, { method: "GET", cache: "no-store" });
  if (res.status === 404 || !res.ok) return null;
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const data = json as { error?: boolean; room?: RoomDetails };
  if (data.error !== false || data.room == null) return null;
  return data.room;
}

export async function clientGetMessagesPage(
  roomId: string,
  cursor: string | null,
  limit: number,
): Promise<MessagesPage> {
  const search = new URLSearchParams();
  if (cursor != null) search.set("cursor", cursor);
  search.set("limit", String(limit));

  const data = await fetchApiOk<{ items: MessagesPage; nextCursor: string | null }>(
    `/api/rooms/${roomId}/messages?${search.toString()}`,
    { method: "GET", cache: "no-store" },
  );
  return data.items;
}
