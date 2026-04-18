import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { chatKeys } from "@domains/chat/queries/keys";
import type { MessagesPage } from "@domains/chat/queries/message-fetchers";
import type {
  CachedMessage,
  MessageStatus,
} from "@domains/chat/types/chat.types";

type MessagesCache = InfiniteData<MessagesPage, string | null>;

function emptyCache(): MessagesCache {
  return { pages: [[]], pageParams: [null] };
}

/**
 * Within the messages infinite cache, page 0 holds the newest messages.
 * Inserting a brand-new message means prepending it to that page.
 * If the message id already exists, it is replaced in-place (used for both
 * realtime echoes and confirming optimistic inserts).
 */
function upsertIntoLatestPage(
  cache: MessagesCache | undefined,
  message: CachedMessage,
): MessagesCache {
  const current = cache ?? emptyCache();
  const [latest, ...rest] = current.pages;

  for (const page of current.pages) {
    if (page.some((m) => m.id === message.id)) {
      return {
        ...current,
        pages: current.pages.map((p) =>
          p.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
        ),
      };
    }
  }

  return {
    ...current,
    pages: [[message, ...latest], ...rest],
  };
}

export function appendOptimisticMessage(
  queryClient: QueryClient,
  roomId: string,
  message: CachedMessage,
) {
  queryClient.setQueryData<MessagesCache>(chatKeys.messages(roomId), (cache) =>
    upsertIntoLatestPage(cache, message),
  );
}

export function applyMessageStatus(
  queryClient: QueryClient,
  roomId: string,
  messageId: string,
  status: MessageStatus,
) {
  queryClient.setQueryData<MessagesCache>(chatKeys.messages(roomId), (cache) =>
    cache == null
      ? cache
      : {
          ...cache,
          pages: cache.pages.map((page) =>
            page.map((m) => (m.id === messageId ? { ...m, status } : m)),
          ),
        },
  );
}

export function replaceMessage(
  queryClient: QueryClient,
  roomId: string,
  message: CachedMessage,
) {
  queryClient.setQueryData<MessagesCache>(chatKeys.messages(roomId), (cache) =>
    upsertIntoLatestPage(cache, message),
  );
}

export function removeMessage(
  queryClient: QueryClient,
  roomId: string,
  messageId: string,
) {
  queryClient.setQueryData<MessagesCache>(chatKeys.messages(roomId), (cache) =>
    cache == null
      ? cache
      : {
          ...cache,
          pages: cache.pages.map((page) =>
            page.filter((m) => m.id !== messageId),
          ),
        },
  );
}
