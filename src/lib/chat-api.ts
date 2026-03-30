import { apiJson } from "@/lib/api-client";

export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ChatMessageAttachment = {
  mimeType: string;
  base64: string;
};

export type ChatMessageRow = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  attachments?: ChatMessageAttachment[] | null;
};

export type ChatDetailPageResponse = {
  chat: ChatSummary;
  messages: ChatMessageRow[];
  page: {
    limit: number;
    hasOlder: boolean;
    oldestMessageId: string | null;
  };
};

export function fetchChatDetailPage(
  chatId: string,
  options?: { limit?: number; before?: string },
): Promise<ChatDetailPageResponse> {
  const qs = new URLSearchParams();
  qs.set("limit", String(options?.limit ?? 100));
  if (options?.before) qs.set("before", options.before);
  return apiJson<ChatDetailPageResponse>(`/api/chats/${chatId}?${qs}`);
}
