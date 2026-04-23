"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { chatKeys } from "./keys";
import { fetchJoinedRooms, fetchRoom } from "./room-fetchers";

export type { RoomDetails, RoomListItem } from "./room-fetchers";

export { fetchJoinedRooms, fetchRoom } from "./room-fetchers";

export const joinedRoomsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: chatKeys.joinedRooms(userId),
    queryFn: () => fetchJoinedRooms(getSupabaseBrowserClient(), userId),
    enabled: Boolean(userId),
  });

export const roomQueryOptions = (roomId: string, userId: string) =>
  queryOptions({
    queryKey: chatKeys.room(roomId),
    queryFn: () => fetchRoom(getSupabaseBrowserClient(), roomId, userId),
    enabled: Boolean(roomId && userId),
  });

export function useJoinedRooms(userId: string) {
  return useQuery(joinedRoomsQueryOptions(userId));
}

export function useRoom(roomId: string, userId: string) {
  return useQuery(roomQueryOptions(roomId, userId));
}
