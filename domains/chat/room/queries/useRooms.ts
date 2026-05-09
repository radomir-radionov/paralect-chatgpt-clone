"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { chatFetchRetry } from "@shared/lib/query/chatFetchRetry";

import { chatKeys } from "./keys";
import { clientGetJoinedRooms, clientGetRoom } from "./clientChatFetchers";

export type { RoomDetails, RoomListItem } from "./room-fetchers";

export const joinedRoomsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: chatKeys.joinedRooms(userId),
    queryFn: () => clientGetJoinedRooms(),
    enabled: Boolean(userId),
    refetchOnWindowFocus: false,
    retryOnMount: false,
    staleTime: 30_000,
    retry: chatFetchRetry,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });

export const roomQueryOptions = (roomId: string, userId: string) =>
  queryOptions({
    queryKey: chatKeys.room(roomId),
    queryFn: () => clientGetRoom(roomId),
    enabled: Boolean(roomId && userId),
    refetchOnWindowFocus: false,
    retryOnMount: false,
    staleTime: 30_000,
    retry: chatFetchRetry,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });

export function useJoinedRooms(userId: string) {
  return useQuery(joinedRoomsQueryOptions(userId));
}

export function useRoom(
  roomId: string,
  userId: string,
  options?: { readonly enabled?: boolean },
) {
  const base = roomQueryOptions(roomId, userId);
  return useQuery({
    ...base,
    enabled: options?.enabled === false ? false : base.enabled,
  });
}
