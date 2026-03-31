"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Send } from "lucide-react";
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
import { logDebugIngest } from "@/lib/debug-ingest";
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

export function ChatMain() {
  const params = useParams<{ chatId?: string }>();
  const chatId = typeof params.chatId === "string" ? params.chatId : undefined;
  const { user, authLoading, routingChatId, setRoutingChatId } = useChatLayout();
  const { isCreatingChat } = useChatShell();
  const effectiveChatId = chatId ?? routingChatId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const isGuestResolved = !authLoading && !user;
  const [modelId, setModelId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<
    { mimeType: string; base64: string; preview: string }[]
  >([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    enabled: isGuestResolved,
  });

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

  const chatKey = getChatKey(user?.id, effectiveChatId);
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
    mode: user ? "auth" : "guest",
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
    if (sendLockRef.current) return;

    const trimmedDraft = draft.trim();
    const hasImages = pendingImages.length > 0;
    if (!trimmedDraft && !hasImages) return;

    if (!modelId && modelsQuery.data?.models?.length) {
      setModelId(modelsQuery.data.models[0]!.id);
    }

    const currentModel =
      modelId || modelsQuery.data?.models?.[0]?.id || "openai:gpt-4o-mini";
    const imagePayload = hasImages
      ? pendingImages.map(({ mimeType, base64 }) => ({ mimeType, base64 }))
      : undefined;
    const sendParts = buildUserSendParts(trimmedDraft, hasImages);

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

    let assistantMessageId: string | null = null;
    let targetChatKey = chatKey;
    let syncChatUrlToId: string | undefined;

    try {
      if (!user) {
        const userMessageId = crypto.randomUUID();
        assistantMessageId = crypto.randomUUID();

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
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(
            typeof errorBody.error === "string"
              ? errorBody.error
              : response.statusText,
          );
        }

        await parseSseStream(response, {
          onToken: (chunk) =>
            appendAssistantChunk(assistantMessageId!, chunk, targetChatKey),
          onDone: () => completeAssistant(assistantMessageId!, targetChatKey),
        });

        void queryClient.invalidateQueries({ queryKey: ["guest-quota"] });
        return;
      }

      const userMessageId = crypto.randomUUID();
      assistantMessageId = crypto.randomUUID();

      startSend({
        userMessage: {
          id: userMessageId,
          content: sendParts.apiContent,
          messageType: sendParts.messageType,
          attachments: imagePayload,
        },
        assistantMessage: { id: assistantMessageId },
      });
      logDebugIngest({
        sessionId: "d6f539",
        runId: "initial-debug",
        hypothesisId: "H2-H4",
        location: "src/components/chat/chat-main.tsx:startSend",
        message: "auth startSend dispatched",
        data: {
          chatKey,
          effectiveChatId: effectiveChatId ?? null,
          userMessageId,
          assistantMessageId,
          imageCount: imagePayload?.length ?? 0,
        },
      });

      let activeChatId = effectiveChatId;

      if (!activeChatId) {
        const created = await apiJson<{ chat: ChatRow }>("/api/chats", {
          method: "POST",
          body: JSON.stringify({
            title: trimmedDraft ? trimmedDraft.slice(0, 80) : undefined,
          }),
        });
        activeChatId = created.chat.id;
        targetChatKey = getChatKey(user.id, activeChatId);
        moveThread(chatKey, targetChatKey);
        upsertChatInListCache(queryClient, created.chat);
        primeNewChatDetailCache(queryClient, created.chat);
        setRoutingChatId(activeChatId);
        syncChatUrlToId = activeChatId;
        logDebugIngest({
          sessionId: "d6f539",
          runId: "initial-debug",
          hypothesisId: "H3-H4",
          location: "src/components/chat/chat-main.tsx:afterCreateChat",
          message: "auth draft thread moved after chat creation",
          data: {
            previousChatKey: chatKey,
            targetChatKey,
            activeChatId,
            movedFromDraft: chatKey === "auth:draft",
          },
        });
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
          }),
        },
      );
      logDebugIngest({
        sessionId: "d6f539",
        runId: "initial-debug",
        hypothesisId: "H1-H4",
        location: "src/components/chat/chat-main.tsx:streamResponse",
        message: "auth stream response received",
        data: {
          activeChatId,
          targetChatKey,
          status: response.status,
          ok: response.ok,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseChatErrorResponseText(text, response.status));
      }

      await parseSseStream(response, {
        onToken: (chunk) =>
          appendAssistantChunk(assistantMessageId!, chunk, targetChatKey),
        onDone: () => completeAssistant(assistantMessageId!, targetChatKey),
      });

      if (syncChatUrlToId) {
        router.replace(`/chat/${syncChatUrlToId}`);
      }

      reconcileAuthChatAfterStream({ queryClient });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (assistantMessageId) {
          failAssistant(assistantMessageId, "", targetChatKey);
        }
        return;
      }
      console.error(error);
      const message = toUserFacingChatErrorMessage(error);
      logDebugIngest({
        sessionId: "d6f539",
        runId: "initial-debug",
        hypothesisId: "H1-H4",
        location: "src/components/chat/chat-main.tsx:sendError",
        message: "auth sendMessage caught error",
        data: {
          targetChatKey,
          assistantMessageId,
          errorMessage: message,
          rawError:
            error instanceof Error ? error.message : "unknown non-error value",
        },
      });
      setSendError(message);
      if (assistantMessageId) {
        failAssistant(assistantMessageId, message, targetChatKey);
      }
    } finally {
      sendLockRef.current = false;
    }
  };

  return (
    <>
      <header className="border-sidebar-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-lg font-semibold">
            {user
              ? chatDetailQuery.data?.pages?.[0]?.chat?.title ?? "New chat"
              : "Guest chat"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isGuestResolved && (
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isBusy || isCreatingChat}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
              title="Attach image"
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
