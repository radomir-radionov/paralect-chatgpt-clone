import type { CachedMessage } from "@domains/chat/types/chat.types";

export const MESSAGES_PAGE_SIZE = 25;
export const MESSAGES_INITIAL_PAGE_SIZE = 10;

export type MessagesPage = CachedMessage[];

export function getNextPageParamForMessages(
  lastPage: MessagesPage,
  _allPages: MessagesPage[],
  lastPageParam: string | null | undefined,
): string | undefined {
  const expected =
    lastPageParam == null ? MESSAGES_INITIAL_PAGE_SIZE : MESSAGES_PAGE_SIZE;
  if (lastPage.length < expected) return undefined;
  const last = lastPage[lastPage.length - 1];
  if (last == null) return undefined;
  return `${last.created_at}|${last.id}`;
}
