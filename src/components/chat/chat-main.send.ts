import type { User } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { apiJson, parseSseStream } from "@/lib/api-client";
import { USER_IMAGE_PROMPT } from "@/lib/chat-prompts";
import { parseChatErrorResponseText } from "@/lib/chat-error";
import { primeNewChatDetailCache, upsertChatInListCache } from "@/lib/chats-cache";
import type { ChatThreadMessage } from "@/components/chat/chat-thread.types";
import { reconcileAuthChatAfterStream } from "@/components/chat/chat-sync";
import type { ChatSummary } from "@/lib/chat-api";
import type { StartSendPayload } from "@/components/chat/thread-state";

type ChatRow = ChatSummary;

export function getChatKey(userId: string | undefined, chatId: string | undefined) {
  return userId ? `auth:${chatId ?? "draft"}` : "guest:default";
}

function toGuestRequestMessage(message: ChatThreadMessage) {
  if (message.role === "assistant") {
    return { role: "assistant" as const, content: message.content };
  }
  const images = message.attachments?.length
    ? message.attachments.map((attachment) => ({
        mimeType: attachment.mimeType,
        base64: attachment.base64,
      }))
    : undefined;
  return {
    role: "user" as const,
    content: message.content,
    images,
  };
}

function buildUserSendParts(trimmed: string, hasImages: boolean) {
  if (hasImages && !trimmed) {
    return {
      apiContent: USER_IMAGE_PROMPT,
      messageType: "image" as const,
    };
  }
  if (hasImages) {
    return { apiContent: trimmed, messageType: "image" as const };
  }
  return { apiContent: trimmed, messageType: "text" as const };
}

export type SendContext = {
  userMessageId: string;
  assistantMessageId: string;
  sendParts: ReturnType<typeof buildUserSendParts>;
  imagePayload: { mimeType: string; base64: string }[] | undefined;
  currentModel: string;
  documentIds: string[];
};

export function buildSendContext({
  draft,
  pendingImages,
  modelId,
  modelsQuery,
  documentIds,
}: {
  draft: string;
  pendingImages: { mimeType: string; base64: string; preview: string }[];
  modelId: string;
  modelsQuery: {
    data: { models: { id: string; label: string }[] } | undefined;
  };
  documentIds: string[];
}): SendContext {
  const trimmedDraft = draft.trim();
  const hasImages = pendingImages.length > 0;

  const imagePayload = hasImages
    ? pendingImages.map(({ mimeType, base64 }) => ({ mimeType, base64 }))
    : undefined;

  const sendParts = buildUserSendParts(trimmedDraft, hasImages);

  const currentModel =
    modelId || modelsQuery.data?.models?.[0]?.id || "openai:gpt-4o-mini";

  return {
    userMessageId: crypto.randomUUID(),
    assistantMessageId: crypto.randomUUID(),
    sendParts,
    imagePayload,
    currentModel,
    documentIds,
  };
}

async function streamAssistantResponse(options: {
  response: Response;
  assistantMessageId: string;
  targetChatKey: string;
  appendAssistantChunk: (assistantId: string, chunk: string, chatKey?: string) => void;
  completeAssistant: (assistantId: string, chatKey?: string) => void;
}) {
  const {
    response,
    assistantMessageId,
    targetChatKey,
    appendAssistantChunk,
    completeAssistant,
  } = options;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseChatErrorResponseText(text, response.status));
  }

  await parseSseStream(response, {
    onToken: (chunk) => appendAssistantChunk(assistantMessageId, chunk, targetChatKey),
    onDone: () => completeAssistant(assistantMessageId, targetChatKey),
  });
}

type ThreadStateSendFns = {
  startSend: (payload: StartSendPayload, targetChatKey?: string) => void;
  moveThread: (fromChatKey: string, toChatKey: string) => void;
  appendAssistantChunk: (messageId: string, chunk: string, targetChatKey?: string) => void;
  completeAssistant: (messageId: string, targetChatKey?: string) => void;
};

export async function sendGuestMessage(options: {
  ctx: SendContext;
  messages: ChatThreadMessage[];
  streamController: AbortController;
  queryClient: QueryClient;
  thread: Pick<
    ThreadStateSendFns,
    "startSend" | "appendAssistantChunk" | "completeAssistant"
  >;
  onSentWithDocuments: () => void;
}) {
  const { ctx, messages, streamController, queryClient, thread, onSentWithDocuments } =
    options;
  const { userMessageId, assistantMessageId, sendParts, imagePayload, currentModel, documentIds } =
    ctx;

  const targetChatKey = "guest:default";

  thread.startSend(
    {
      userMessage: {
        id: userMessageId,
        content: sendParts.apiContent,
        messageType: sendParts.messageType,
        attachments: imagePayload,
        synced: true,
      },
      assistantMessage: { id: assistantMessageId, synced: true },
    },
    targetChatKey,
  );

  const guestHistory = [
    ...messages.map(toGuestRequestMessage),
    {
      role: "user" as const,
      content: sendParts.apiContent,
      images: imagePayload,
    },
  ];

  const response = await fetch("/api/guest/stream", {
    method: "POST",
    credentials: "include",
    signal: streamController.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId: currentModel,
      messages: guestHistory,
      ...(documentIds.length ? { documentIds } : {}),
    }),
  });

  await streamAssistantResponse({
    response,
    assistantMessageId,
    targetChatKey,
    appendAssistantChunk: thread.appendAssistantChunk,
    completeAssistant: thread.completeAssistant,
  });

  void queryClient.invalidateQueries({ queryKey: ["guest-quota"] });
  void queryClient.invalidateQueries({ queryKey: ["guest-documents"] });
  if (documentIds.length) onSentWithDocuments();
}

export async function sendAuthMessage(options: {
  ctx: SendContext;
  user: User;
  effectiveChatId: string | undefined;
  chatKey: string;
  streamController: AbortController;
  queryClient: QueryClient;
  router: { replace: (href: string) => void };
  setRoutingChatId: (id: string | undefined) => void;
  thread: Pick<ThreadStateSendFns, keyof ThreadStateSendFns>;
  onSentWithDocuments: () => void;
}) {
  const {
    ctx,
    user,
    effectiveChatId,
    chatKey,
    streamController,
    queryClient,
    router,
    setRoutingChatId,
    thread,
    onSentWithDocuments,
  } = options;

  const { userMessageId, assistantMessageId, sendParts, imagePayload, currentModel, documentIds } =
    ctx;

  thread.startSend({
    userMessage: {
      id: userMessageId,
      content: sendParts.apiContent,
      messageType: sendParts.messageType,
      attachments: imagePayload,
    },
    assistantMessage: { id: assistantMessageId },
  });

  let activeChatId = effectiveChatId;
  let targetChatKey = chatKey;
  let syncChatUrlToId: string | undefined;

  if (!activeChatId) {
    const created = await apiJson<{ chat: ChatRow }>("/api/chats", {
      method: "POST",
      body: JSON.stringify({
        title: sendParts.apiContent ? sendParts.apiContent.slice(0, 80) : undefined,
      }),
    });
    activeChatId = created.chat.id;
    targetChatKey = getChatKey(user.id, activeChatId);
    thread.moveThread(chatKey, targetChatKey);
    upsertChatInListCache(queryClient, created.chat);
    primeNewChatDetailCache(queryClient, created.chat);
    setRoutingChatId(activeChatId);
    syncChatUrlToId = activeChatId;
  } else {
    targetChatKey = getChatKey(user.id, activeChatId);
    if (targetChatKey !== chatKey) {
      thread.moveThread(chatKey, targetChatKey);
    }
  }

  const response = await fetch(`/api/chats/${activeChatId}/messages/stream`, {
    method: "POST",
    credentials: "include",
    signal: streamController.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userMessageId,
      assistantMessageId,
      content: sendParts.apiContent,
      modelId: currentModel,
      images: imagePayload,
      ...(documentIds.length ? { documentIds } : {}),
    }),
  });

  await streamAssistantResponse({
    response,
    assistantMessageId,
    targetChatKey,
    appendAssistantChunk: thread.appendAssistantChunk,
    completeAssistant: thread.completeAssistant,
  });

  if (syncChatUrlToId) {
    router.replace(`/chat/${syncChatUrlToId}`);
  }

  void queryClient.invalidateQueries({ queryKey: ["documents"] });
  if (documentIds.length) onSentWithDocuments();

  reconcileAuthChatAfterStream({ queryClient });
}

