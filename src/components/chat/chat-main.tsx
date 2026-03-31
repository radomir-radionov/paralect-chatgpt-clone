"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ImageIcon, Loader2, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { toThreadMessage, type ChatThreadMessage } from "@/components/chat/chat-thread.types";
import { reconcileAuthChatAfterStream } from "@/components/chat/chat-sync";
import { shouldPollPendingSync } from "@/components/chat/thread-state";
import { useChatThreadState } from "@/components/chat/use-chat-thread-state";
import { useChatLayout } from "@/components/chat/chat-layout-context";
import { useChatShell } from "@/components/chat/chat-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiJson, parseSseStream } from "@/lib/api-client";
import { USER_IMAGE_PROMPT } from "@/lib/chat-prompts";
import {
  assertImageFileClient,
  CHAT_IMAGE_ACCEPT_ATTR,
  getClipboardImageFile,
} from "@/lib/image-attachment";
import {
  isChatNotFoundError,
  parseChatErrorResponseText,
  toUserFacingChatErrorMessage,
} from "@/lib/chat-error";
import { primeNewChatDetailCache, upsertChatInListCache } from "@/lib/chats-cache";
import {
  fetchChatDetailPage,
  type ChatSummary,
} from "@/lib/chat-api";

type ChatRow = ChatSummary;

function getChatKey(userId: string | undefined, chatId: string | undefined) {
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

const MAX_DOCS_PER_MESSAGE = 8;

type SendContext = {
  userMessageId: string;
  assistantMessageId: string;
  sendParts: ReturnType<typeof buildUserSendParts>;
  imagePayload: { mimeType: string; base64: string }[] | undefined;
  currentModel: string;
  documentIds: string[];
};

function buildSendContext({
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

async function streamAssistantResponse(
  response: Response,
  assistantMessageId: string,
  targetChatKey: string,
  appendAssistantChunk: (
    assistantId: string,
    chunk: string,
    chatKey: string,
  ) => void,
  completeAssistant: (assistantId: string, chatKey: string) => void,
) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseChatErrorResponseText(text, response.status));
  }

  await parseSseStream(response, {
    onToken: (chunk) =>
      appendAssistantChunk(assistantMessageId, chunk, targetChatKey),
    onDone: () => completeAssistant(assistantMessageId, targetChatKey),
  });
}

async function sendGuestMessage(options: {
  ctx: SendContext;
  messages: ChatThreadMessage[];
  streamController: AbortController;
  startSend: ReturnType<typeof useChatThreadState>["startSend"];
  appendAssistantChunk: ReturnType<
    typeof useChatThreadState
  >["appendAssistantChunk"];
  completeAssistant: ReturnType<typeof useChatThreadState>["completeAssistant"];
  queryClient: ReturnType<typeof useQueryClient>;
  onSentWithDocuments: () => void;
}) {
  const {
    ctx,
    messages,
    streamController,
    startSend,
    appendAssistantChunk,
    completeAssistant,
    queryClient,
    onSentWithDocuments,
  } = options;

  const {
    userMessageId,
    assistantMessageId,
    sendParts,
    imagePayload,
    currentModel,
    documentIds,
  } = ctx;

  const targetChatKey = "guest:default";

  startSend(
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
      ...(documentIds.length
        ? { documentIds }
        : {}),
    }),
  });

  await streamAssistantResponse(
    response,
    assistantMessageId,
    targetChatKey,
    appendAssistantChunk,
    completeAssistant,
  );

  void queryClient.invalidateQueries({ queryKey: ["guest-quota"] });
  void queryClient.invalidateQueries({ queryKey: ["guest-documents"] });
  if (documentIds.length) onSentWithDocuments();
}

async function sendAuthMessage(options: {
  ctx: SendContext;
  user: NonNullable<ReturnType<typeof useChatLayout>["user"]>;
  effectiveChatId: string | undefined;
  chatKey: string;
  streamController: AbortController;
  startSend: ReturnType<typeof useChatThreadState>["startSend"];
  moveThread: ReturnType<typeof useChatThreadState>["moveThread"];
  queryClient: ReturnType<typeof useQueryClient>;
  router: ReturnType<typeof useRouter>;
  setRoutingChatId: (id: string | undefined) => void;
  appendAssistantChunk: ReturnType<
    typeof useChatThreadState
  >["appendAssistantChunk"];
  completeAssistant: ReturnType<typeof useChatThreadState>["completeAssistant"];
  onSentWithDocuments: () => void;
}) {
  const {
    ctx,
    user,
    effectiveChatId,
    chatKey,
    streamController,
    startSend,
    moveThread,
    queryClient,
    router,
    setRoutingChatId,
    appendAssistantChunk,
    completeAssistant,
    onSentWithDocuments,
  } = options;

  const {
    userMessageId,
    assistantMessageId,
    sendParts,
    imagePayload,
    currentModel,
    documentIds,
  } = ctx;

  startSend({
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
    moveThread(chatKey, targetChatKey);
    upsertChatInListCache(queryClient, created.chat);
    primeNewChatDetailCache(queryClient, created.chat);
    setRoutingChatId(activeChatId);
    syncChatUrlToId = activeChatId;
  } else {
    targetChatKey = getChatKey(user.id, activeChatId);
    if (targetChatKey !== chatKey) {
      moveThread(chatKey, targetChatKey);
    }
  }

  const response = await fetch(
    `/api/chats/${activeChatId}/messages/stream`,
    {
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
    },
  );

  await streamAssistantResponse(
    response,
    assistantMessageId,
    targetChatKey,
    appendAssistantChunk,
    completeAssistant,
  );

  if (syncChatUrlToId) {
    router.replace(`/chat/${syncChatUrlToId}`);
  }

  void queryClient.invalidateQueries({ queryKey: ["documents"] });
  if (documentIds.length) onSentWithDocuments();

  reconcileAuthChatAfterStream({ queryClient });
}

export function ChatMain() {
  const params = useParams<{ chatId?: string }>();
  const chatId = typeof params.chatId === "string" ? params.chatId : undefined;
  const { user, authLoading, routingChatId, setRoutingChatId } = useChatLayout();
  const { isCreatingChat } = useChatShell();
  const effectiveChatId = chatId ?? routingChatId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthResolved = !authLoading;
  const isGuestMode = isAuthResolved && !user;
  const [modelId, setModelId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<
    { mimeType: string; base64: string; preview: string }[]
  >([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docUploadRef = useRef<HTMLInputElement>(null);
  /** Blocks re-entrancy before React applies `status` from startSend (sync vs async gap). */
  const sendLockRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: () =>
      apiJson<{ models: { id: string; label: string }[] }>("/api/models"),
    staleTime: 86_400_000,
  });

  useEffect(() => {
    const first = modelsQuery.data?.models?.[0]?.id;
    if (first && !modelId) setModelId(first);
  }, [modelsQuery.data, modelId]);

  useEffect(() => {
    if (chatId && routingChatId && chatId === routingChatId) {
      setRoutingChatId(undefined);
    }
  }, [chatId, routingChatId, setRoutingChatId]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const quotaQuery = useQuery({
    queryKey: ["guest-quota"],
    queryFn: () =>
      apiJson<{ used: number; remaining: number; limit: number }>(
        "/api/guest/quota",
      ),
    enabled: isGuestMode,
  });

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () =>
      apiJson<{
        documents: { id: string; filename: string; status: string }[];
      }>("/api/documents"),
    enabled: !!user,
  });

  const guestDocumentsQuery = useQuery({
    queryKey: ["guest-documents"],
    queryFn: () =>
      apiJson<{
        documents: { id: string; filename: string; status: string }[];
      }>("/api/guest/documents"),
    enabled: isGuestMode,
  });

  const docList = useMemo(() => {
    if (user) return documentsQuery.data?.documents ?? [];
    if (isGuestMode) return guestDocumentsQuery.data?.documents ?? [];
    return [];
  }, [user, isGuestMode, documentsQuery.data, guestDocumentsQuery.data]);

  const toggleDocumentSelection = useCallback((id: string) => {
    setSelectedDocumentIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DOCS_PER_MESSAGE) return prev;
      return [...prev, id];
    });
  }, []);

  const handleDocumentUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setSendError(null);
      const path = user ? "/api/documents" : "/api/guest/documents";
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(path, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSendError(
          typeof err.error === "string" ? err.error : "Document upload failed",
        );
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: user ? ["documents"] : ["guest-documents"],
      });
    },
    [queryClient, user],
  );

  const chatDetailQuery = useInfiniteQuery({
    queryKey: ["chat", effectiveChatId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchChatDetailPage(
        effectiveChatId!,
        pageParam ? { before: pageParam } : {},
      ),
    getNextPageParam: (lastPage) =>
      lastPage.page.hasOlder && lastPage.page.oldestMessageId
        ? lastPage.page.oldestMessageId
        : undefined,
    enabled: !!user && !!effectiveChatId,
    retry: (failureCount, error) => {
      if (isChatNotFoundError(error)) return false;
      return failureCount < 1;
    },
  });

  useEffect(() => {
    if (!user || !effectiveChatId) return;
    if (!chatDetailQuery.isError) return;
    if (!isChatNotFoundError(chatDetailQuery.error)) return;
    queryClient.removeQueries({ queryKey: ["chat", effectiveChatId] });
    router.replace("/chat");
  }, [
    user,
    effectiveChatId,
    chatDetailQuery.isError,
    chatDetailQuery.error,
    queryClient,
    router,
  ]);

  const serverMessages = useMemo(() => {
    if (!user) return [];
    const pages = chatDetailQuery.data?.pages;
    if (!pages?.length) return [];
    return [...pages]
      .reverse()
      .flatMap((page) =>
        page.messages.map((message) =>
          toThreadMessage({
            ...message,
            attachments: message.attachments ?? undefined,
          }),
        ),
      );
  }, [chatDetailQuery.data?.pages, user]);

  const chatKey = user
    ? getChatKey(user.id, effectiveChatId)
    : isAuthResolved
      ? "guest:default"
      : "auth:draft";
  const {
    messages,
    status,
    hasPendingSync,
    startSend,
    moveThread,
    appendAssistantChunk,
    completeAssistant,
    failAssistant,
  } = useChatThreadState({
    chatKey,
    mode: user ? "auth" : isAuthResolved ? "guest" : "auth",
    serverMessages,
    hydrateFromServer: !!user && !!effectiveChatId && !!chatDetailQuery.data,
  });

  const shouldSyncPendingThread = shouldPollPendingSync({
    userId: user?.id,
    chatId: effectiveChatId,
    hasPendingSync,
    status,
  });

  const chatDetailNotFound =
    !!user &&
    !!effectiveChatId &&
    chatDetailQuery.isError &&
    isChatNotFoundError(chatDetailQuery.error);

  useEffect(() => {
    if (!effectiveChatId || !shouldSyncPendingThread || chatDetailNotFound) return;

    let cancelled = false;
    let attempts = 0;

    const syncThread = async () => {
      if (cancelled || attempts >= 5) return;
      attempts += 1;
      try {
        await queryClient.fetchInfiniteQuery({
          queryKey: ["chat", effectiveChatId],
          initialPageParam: undefined as string | undefined,
          queryFn: ({ pageParam }) =>
            fetchChatDetailPage(
              effectiveChatId,
              pageParam ? { before: pageParam } : {},
            ),
        });
        if (cancelled) return;
      } catch (error) {
        if (cancelled) return;
        if (isChatNotFoundError(error)) {
          queryClient.removeQueries({ queryKey: ["chat", effectiveChatId] });
          router.replace("/chat");
          return;
        }
        console.error(error);
      }
    };

    void syncThread();
    const intervalId = window.setInterval(() => {
      void syncThread();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    effectiveChatId,
    queryClient,
    router,
    shouldSyncPendingThread,
    chatDetailNotFound,
  ]);

  const readFileAsBase64 = (file: File) =>
    new Promise<{ mimeType: string; base64: string; preview: string }>(
      (resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] ?? "";
          resolve({
            mimeType: file.type,
            base64,
            preview: URL.createObjectURL(file),
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      },
    );

  const addValidatedImage = useCallback(async (file: File) => {
    const err = assertImageFileClient(file);
    if (err) {
      setSendError(err);
      return;
    }
    setSendError(null);
    const image = await readFileAsBase64(file);
    setPendingImages((previous) => {
      for (const img of previous) {
        URL.revokeObjectURL(img.preview);
      }
      return [image];
    });
  }, []);

  const handlePasteImage = useCallback(
    async (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items?.length) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item) continue;
        const file = getClipboardImageFile(item);
        if (!file) continue;
        event.preventDefault();
        await addValidatedImage(file);
        break;
      }
    },
    [addValidatedImage],
  );

  const isBusy = status === "sending" || status === "streaming";

  const sendMessage = async () => {
    if (authLoading) {
      setSendError("Resolving your account… please try again in a moment.");
      return;
    }

    if (sendLockRef.current) return;

    const trimmedDraft = draft.trim();
    const hasImages = pendingImages.length > 0;
    if (!trimmedDraft && !hasImages) return;

    if (!modelId && modelsQuery.data?.models?.length) {
      setModelId(modelsQuery.data.models[0]!.id);
    }

    sendLockRef.current = true;
    streamAbortRef.current?.abort();
    const streamController = new AbortController();
    streamAbortRef.current = streamController;
    setSendError(null);
    setDraft("");
    setPendingImages((previous) => {
      for (const image of previous) {
        URL.revokeObjectURL(image.preview);
      }
      return [];
    });

    const ctx = buildSendContext({
      draft,
      pendingImages,
      modelId,
      modelsQuery: {
        data: modelsQuery.data,
      },
      documentIds: selectedDocumentIds,
    });

    const clearDocSelectionIfUsed = () => {
      if (ctx.documentIds.length > 0) {
        setSelectedDocumentIds([]);
      }
    };

    try {
      if (isGuestMode) {
        await sendGuestMessage({
          ctx,
          messages,
          streamController,
          startSend,
          appendAssistantChunk,
          completeAssistant,
          queryClient,
          onSentWithDocuments: clearDocSelectionIfUsed,
        });
        return;
      }

      await sendAuthMessage({
        ctx,
        user: user!,
        effectiveChatId,
        chatKey,
        streamController,
        startSend,
        moveThread,
        queryClient,
        router,
        setRoutingChatId,
        appendAssistantChunk,
        completeAssistant,
        onSentWithDocuments: clearDocSelectionIfUsed,
      });
    } catch (error) {
      const isAbort =
        error instanceof DOMException && error.name === "AbortError";
      const targetChatKey = user
        ? getChatKey(user.id, effectiveChatId)
        : chatKey;

      if (isAbort) {
        failAssistant(ctx.assistantMessageId, "", targetChatKey);
        return;
      }

      console.error(error);
      const message = toUserFacingChatErrorMessage(error);
      setSendError(message);
      failAssistant(ctx.assistantMessageId, message, targetChatKey);
    } finally {
      sendLockRef.current = false;
    }
  };

  return (
    <>
      <header className="border-sidebar-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-lg font-semibold">
            {authLoading
              ? "Loading…"
              : user
                ? chatDetailQuery.data?.pages?.[0]?.chat?.title ?? "New chat"
                : "Guest chat"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isGuestMode && (
            <span className="text-muted-foreground text-xs">
              {quotaQuery.isLoading
                ? "..."
                : `${quotaQuery.data?.remaining ?? "-"} free left`}
            </span>
          )}
          <label className="sr-only" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 max-w-[min(100vw-8rem,14rem)] rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={modelsQuery.isLoading || !modelsQuery.data?.models?.length}
          >
            {modelsQuery.data?.models?.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          {modelsQuery.isError && (
            <span className="text-destructive max-w-40 truncate text-xs">
              Set LLM keys in .env
            </span>
          )}
        </div>
      </header>

      <ChatMessageList
        messages={messages}
        status={status}
        isInitialLoading={
          authLoading ||
          (!!user && !!effectiveChatId && chatDetailQuery.isPending && messages.length === 0)
        }
        empty={messages.length === 0 && !isBusy}
        canLoadOlder={
          !!user &&
          !!effectiveChatId &&
          chatDetailQuery.hasNextPage &&
          messages.length > 0
        }
        isLoadingOlder={chatDetailQuery.isFetchingNextPage}
        onLoadOlder={() => void chatDetailQuery.fetchNextPage()}
      />

      <div className="border-sidebar-border bg-background/80 supports-backdrop-filter:bg-background/60 sticky bottom-0 border-t p-4 backdrop-blur">
        {pendingImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingImages.map((image, index) => (
              <div key={image.preview} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.preview}
                  alt=""
                  className="h-16 w-16 rounded-md object-cover"
                />
                <button
                  type="button"
                  className="bg-background/90 absolute -top-1 -right-1 rounded-full p-0.5 text-xs"
                  onClick={() =>
                    setPendingImages((previous) => {
                      const removed = previous[index];
                      if (removed) URL.revokeObjectURL(removed.preview);
                      return previous.filter((_, itemIndex) => itemIndex !== index);
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {sendError && (
            <p
              className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm"
              role="alert"
            >
              {sendError}
            </p>
          )}
          {(user || isGuestMode) && docList.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-2">
                {docList.map((doc) => {
                  const ready = doc.status === "ready";
                  const checked = selectedDocumentIds.includes(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className={`flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                        ready
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        disabled={!ready || isBusy}
                        checked={checked}
                        onChange={() => toggleDocumentSelection(doc.id)}
                      />
                      <span className="truncate">{doc.filename}</span>
                      {!ready && (
                        <span className="text-muted-foreground shrink-0">
                          ({doc.status})
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              {selectedDocumentIds.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {selectedDocumentIds.length} of {MAX_DOCS_PER_MESSAGE}{" "}
                  documents selected for context
                </p>
              )}
            </div>
          )}
          {user && isCreatingChat && (
            <p className="text-muted-foreground text-sm">Creating chat...</p>
          )}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={handlePasteImage}
            placeholder="Message… paste an image or attach (PNG, JPEG, WebP, GIF)"
            className="min-h-[96px] resize-none"
            disabled={isBusy || isCreatingChat}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {(user || isGuestMode) && (
              <input
                ref={docUploadRef}
                type="file"
                accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => void handleDocumentUpload(e)}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={CHAT_IMAGE_ACCEPT_ATTR}
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  try {
                    await addValidatedImage(file);
                  } catch {
                    setSendError("Could not read image file.");
                  }
                }
                event.target.value = "";
              }}
            />
            {(user || isGuestMode) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isBusy || isCreatingChat}
                onClick={() => docUploadRef.current?.click()}
                aria-label="Attach document for context"
                title="PDF, TXT, MD, DOCX · max 5 MB · uses GOOGLE_GENERATIVE_AI_API_KEY (Gemini embeddings)"
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isBusy || isCreatingChat}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
              title="PNG, JPEG, WebP, GIF"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              className="ml-auto gap-2"
              disabled={
                isBusy ||
                isCreatingChat ||
                (!draft.trim() && pendingImages.length === 0) ||
                modelsQuery.isError
              }
              onClick={() => void sendMessage()}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
