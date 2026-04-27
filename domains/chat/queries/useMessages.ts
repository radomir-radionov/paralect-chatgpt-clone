"use client";

import {
  infiniteQueryOptions,
  useInfiniteQuery,
} from "@tanstack/react-query";

import type { CachedMessage } from "@domains/chat/types/chat.types";

import { chatKeys } from "./keys";
import { clientGetMessagesPage } from "./clientChatFetchers";
import {
  getNextPageParamForMessages,
  MESSAGES_INITIAL_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
} from "./message-fetchers";

export {
  fetchMessagesPage,
  MESSAGES_INITIAL_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
} from "./message-fetchers";
export type { MessagesPage } from "./message-fetchers";

export const messagesInfiniteQueryOptions = (roomId: string) =>
  infiniteQueryOptions({
    queryKey: chatKeys.messages(roomId),
    queryFn: ({ pageParam }) =>
      clientGetMessagesPage(
        roomId,
        pageParam,
        pageParam == null ? MESSAGES_INITIAL_PAGE_SIZE : MESSAGES_PAGE_SIZE,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: getNextPageParamForMessages,
    enabled: Boolean(roomId),
    refetchOnWindowFocus: true,
  });

export function useMessages(roomId: string) {
  const query = useInfiniteQuery(messagesInfiniteQueryOptions(roomId));

  // Pages are fetched newest-first (DESC by created_at). Page 0 contains the
  // most recent messages; subsequent pages contain progressively older ones.
  // For the UI we want oldest-first ascending, so reverse the flat list.
  const pages = query.data?.pages ?? [];
  const messages: CachedMessage[] = pages.flatMap((page) => page).reverse();

  return {
    messages,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    status: query.status,
    error: query.error,
  };
}
