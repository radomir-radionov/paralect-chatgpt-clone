import { z } from "zod";

import { fetchApiOk } from "@shared/lib/http/fetchApiOk";

import {
  createRoomSchema,
  deleteRoomSchema,
  updateRoomModelSchema,
} from "@domains/chat/schemas/rooms";

import type { MessagesPage } from "./message-pagination";
import type { RoomDetails, RoomListItem } from "./room-fetchers";

type CreateRoomInput = z.infer<typeof createRoomSchema>;
type UpdateRoomModelInput = z.infer<typeof updateRoomModelSchema>;
type DeleteRoomInput = z.infer<typeof deleteRoomSchema>;

export type ClientCreateRoomResult =
  | { error: true; message: string }
  | { error: false; roomId: string };

export async function clientCreateRoom(data: CreateRoomInput): Promise<ClientCreateRoomResult> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  const d = json as { error?: boolean; message?: string; roomId?: string };
  if (res.ok && d.error === false && typeof d.roomId === "string") {
    return { error: false, roomId: d.roomId };
  }
  return {
    error: true,
    message: typeof d.message === "string" ? d.message : `Request failed (${res.status})`,
  };
}

export async function clientDeleteRoom(
  roomId: DeleteRoomInput["roomId"],
): Promise<{ error: boolean; message?: string }> {
  const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE", cache: "no-store" });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  const d = json as { error?: boolean; message?: string };
  if (res.ok && d.error === false) return { error: false };
  return {
    error: true,
    message:
      typeof d.message === "string" ? d.message : `Request failed (${res.status})`,
  };
}

export async function clientUpdateRoomModel(
  data: UpdateRoomModelInput,
): Promise<{ error: boolean; message?: string }> {
  const res = await fetch(`/api/rooms/${data.roomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelSlug: data.modelSlug }),
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  const d = json as { error?: boolean; message?: string };
  if (res.ok && d.error === false) return { error: false };
  return {
    error: true,
    message:
      typeof d.message === "string" ? d.message : `Request failed (${res.status})`,
  };
}

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
