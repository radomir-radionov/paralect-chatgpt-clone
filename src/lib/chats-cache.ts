import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { ChatDetailPageResponse, ChatSummary } from "@/lib/chat-api";

function emptyChatDetailPage(chatId: string): ChatDetailPageResponse {
  return {
    chat: {
      id: chatId,
      title: "New chat",
      updatedAt: new Date().toISOString(),
    },
    messages: [],
    page: {
      limit: 100,
      hasOlder: false,
      oldestMessageId: null,
    },
  };
}

/** Seeds the thread cache so the main pane shows the empty state immediately after sidebar "New chat". */
export function primeNewChatDetailCache(
  queryClient: QueryClient,
  chat: ChatSummary,
): void {
  queryClient.setQueryData<InfiniteData<ChatDetailPageResponse>>(
    ["chat", chat.id],
    {
      pages: [{ ...emptyChatDetailPage(chat.id), chat }],
      pageParams: [undefined],
    },
  );
}

export function upsertChatInListCache(
  queryClient: QueryClient,
  chat: ChatSummary,
) {
  queryClient.setQueryData<{ chats: ChatSummary[] }>(["chats"], (prev) => {
    if (!prev) return { chats: [chat] };
    const without = prev.chats.filter((c) => c.id !== chat.id);
    return { chats: [chat, ...without] };
  });
}

export function removeChatFromListCache(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<{ chats: ChatSummary[] }>(["chats"], (prev) => {
    if (!prev) return prev;
    return { chats: prev.chats.filter((c) => c.id !== id) };
  });
}
