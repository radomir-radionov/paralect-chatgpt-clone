import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type {
  ChatDetailPageResponse,
  ChatMessageAttachment,
  ChatSummary,
} from "@/lib/chat-api";

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

/** Appends a user message to the first (newest) page so the thread updates before SSE is read. */
export function appendOptimisticUserMessage(
  queryClient: QueryClient,
  chatId: string,
  payload: {
    content: string;
    attachments?: ChatMessageAttachment[] | null;
  },
): void {
  queryClient.setQueryData<InfiniteData<ChatDetailPageResponse>>(
    ["chat", chatId],
    (old) => {
      const base: InfiniteData<ChatDetailPageResponse> =
        old?.pages?.length ?
          old
        : {
            pages: [emptyChatDetailPage(chatId)],
            pageParams: [undefined],
          };
      const p0 = base.pages[0]!;
      const msg = {
        id: `optimistic-${crypto.randomUUID()}`,
        role: "user",
        content: payload.content,
        createdAt: new Date().toISOString(),
        attachments: payload.attachments ?? null,
      };
      return {
        ...base,
        pages: [
          {
            ...p0,
            messages: [...p0.messages, msg],
          },
          ...base.pages.slice(1),
        ],
      };
    },
  );
}

/** Seeds the thread cache so the main pane shows the empty state immediately after sidebar "New chat". */
export function primeNewChatDetailCache(
  queryClient: QueryClient,
  chat: ChatSummary,
): void {
  queryClient.setQueryData<InfiniteData<ChatDetailPageResponse>>(
    ["chat", chat.id],
    {
      pages: [
        {
          chat,
          messages: [],
          page: {
            limit: 100,
            hasOlder: false,
            oldestMessageId: null,
          },
        },
      ],
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
