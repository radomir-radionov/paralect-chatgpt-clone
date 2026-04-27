"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { chatKeys } from "./keys";
import { clientGetJoinedRooms, clientGetRoom } from "./clientChatFetchers";

export type { RoomDetails, RoomListItem } from "./room-fetchers";

export { fetchJoinedRooms, fetchRoom } from "./room-fetchers";

export const joinedRoomsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: chatKeys.joinedRooms(userId),
    queryFn: () => clientGetJoinedRooms(),
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
  });

export const roomQueryOptions = (roomId: string, userId: string) =>
  queryOptions({
    queryKey: chatKeys.room(roomId),
    queryFn: () => clientGetRoom(roomId),
    enabled: Boolean(roomId && userId),
    refetchOnWindowFocus: true,
  });

export function useJoinedRooms(userId: string) {
  return useQuery(joinedRoomsQueryOptions(userId));
}

export function useRoom(roomId: string, userId: string) {
  return useQuery(roomQueryOptions(roomId, userId));
}
