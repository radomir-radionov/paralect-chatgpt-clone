"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ImageIcon, Loader2, Paperclip, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { toThreadMessage, type ChatThreadMessage } from "@/components/chat/chat-thread.types";
import { useChatThreadState } from "@/components/chat/use-chat-thread-state";
import { useChatLayout } from "@/components/chat/chat-layout-context";
import { useChatShell } from "@/components/chat/chat-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiJson, parseSseStream } from "@/lib/api-client";
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
  return {
    role: message.role,
    content: message.content,
    images:
      message.role === "user" && message.attachments?.length
        ? message.attachments.map((attachment) => ({
            mimeType: attachment.mimeType,
            base64: attachment.base64,
          }))
        : undefined,
  };
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
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const sendLockRef = useRef(false);

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
    setSelectedDocIds([]);
  }, [user?.id]);

  useEffect(() => {
    if (chatId && routingChatId && chatId === routingChatId) {
      setRoutingChatId(undefined);
    }
  }, [chatId, routingChatId, setRoutingChatId]);

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
  });

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () =>
      apiJson<{ documents: { id: string; filename: string }[] }>(
        "/api/documents",
      ),
    enabled: !!user,
  });

  const guestDocumentsQuery = useQuery({
    queryKey: ["guest-documents"],
    queryFn: () =>
      apiJson<{ documents: { id: string; filename: string }[] }>(
        "/api/guest/documents",
      ),
    enabled: isGuestResolved,
  });

  const contextLibraryDocs = user
    ? documentsQuery.data?.documents
    : isGuestResolved
      ? guestDocumentsQuery.data?.documents
      : undefined;

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
    appendAssistantChunk,
    completeAssistant,
    failAssistant,
  } = useChatThreadState({
    chatKey,
    mode: user ? "auth" : "guest",
    serverMessages,
    hydrateFromServer: !!user && !!effectiveChatId && !!chatDetailQuery.data,
  });

  useEffect(() => {
    if (!user || !effectiveChatId || !hasPendingSync) return;

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
      } catch (error) {
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
  }, [effectiveChatId, hasPendingSync, queryClient, user]);

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (effectiveChatId) {
        fd.append("meta", JSON.stringify({ chatId: effectiveChatId }));
      }
      const res = await fetch("/api/documents", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
          const json = JSON.parse(text) as { error?: unknown };
          if (typeof json.error === "string") message = json.error;
        } catch {
          /* keep response text */
        }
        throw new Error(message || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ document: { id: string } }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => {
      setSendError(error instanceof Error ? error.message : "Upload failed");
    },
  });

  const uploadGuestDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/guest/documents", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
          const json = JSON.parse(text) as { error?: unknown };
          if (typeof json.error === "string") message = json.error;
        } catch {
          /* keep response text */
        }
        throw new Error(message || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ document: { id: string } }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guest-documents"] });
    },
    onError: (error) => {
      setSendError(error instanceof Error ? error.message : "Upload failed");
    },
  });

  const readFileAsBase64 = (file: File) =>
    new Promise<{ mimeType: string; base64: string; preview: string }>(
      (resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] ?? "";
          resolve({
            mimeType: file.type || "application/octet-stream",
            base64,
            preview: URL.createObjectURL(file),
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      },
    );

  const handlePasteImage = useCallback(
    async (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        const image = await readFileAsBase64(file);
        setPendingImages((previous) => [...previous, image]);
      }
    },
    [],
  );

  const isBusy = status === "sending" || status === "streaming";
  const messageContent = draft.trim() || "What do you see in this image?";

  const sendMessage = async () => {
    if (sendLockRef.current) return;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft && pendingImages.length === 0) return;

    if (!modelId && modelsQuery.data?.models?.length) {
      setModelId(modelsQuery.data.models[0]!.id);
    }

    const currentModel =
      modelId || modelsQuery.data?.models?.[0]?.id || "openai:gpt-4o-mini";
    const images =
      pendingImages.length > 0
        ? pendingImages.map(({ mimeType, base64 }) => ({ mimeType, base64 }))
        : undefined;

    sendLockRef.current = true;
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

    try {
      if (!user) {
        const userMessageId = crypto.randomUUID();
        assistantMessageId = crypto.randomUUID();

        startSend(
          {
            userMessage: {
              id: userMessageId,
              content: messageContent,
              attachments: images,
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
            content: messageContent,
            images,
          },
        ];

        const response = await fetch("/api/guest/stream", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: currentModel,
            messages: guestHistory,
            documentIds: selectedDocIds.length ? selectedDocIds : undefined,
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
        setSelectedDocIds([]);
        return;
      }

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
        upsertChatInListCache(queryClient, created.chat);
        primeNewChatDetailCache(queryClient, created.chat);
        setRoutingChatId(activeChatId);
        router.replace(`/chat/${activeChatId}`);
      } else {
        targetChatKey = getChatKey(user.id, activeChatId);
      }

      const userMessageId = crypto.randomUUID();
      assistantMessageId = crypto.randomUUID();

      startSend(
        {
          userMessage: {
            id: userMessageId,
            content: messageContent,
            attachments: images,
          },
          assistantMessage: { id: assistantMessageId },
        },
        targetChatKey,
      );

      const response = await fetch(
        `/api/chats/${activeChatId}/messages/stream`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessageId,
            assistantMessageId,
            content: messageContent,
            modelId: currentModel,
            images,
            documentIds: selectedDocIds.length ? selectedDocIds : undefined,
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      await parseSseStream(response, {
        onToken: (chunk) =>
          appendAssistantChunk(assistantMessageId!, chunk, targetChatKey),
        onDone: () => completeAssistant(assistantMessageId!, targetChatKey),
      });

      await queryClient.fetchInfiniteQuery({
        queryKey: ["chat", activeChatId],
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) =>
          fetchChatDetailPage(
            activeChatId!,
            pageParam ? { before: pageParam } : {},
          ),
      });
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      setSelectedDocIds([]);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to send message";
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

      {contextLibraryDocs && (
        <div className="border-sidebar-border flex flex-wrap gap-2 border-t px-4 py-2">
          <span className="text-muted-foreground w-full text-xs">
            Context documents
          </span>
          {contextLibraryDocs.map((document) => (
            <label
              key={document.id}
              className="flex cursor-pointer items-center gap-2 text-xs"
            >
              <input
                type="checkbox"
                checked={selectedDocIds.includes(document.id)}
                onChange={(event) => {
                  setSelectedDocIds((previous) =>
                    event.target.checked
                      ? [...previous, document.id]
                      : previous.filter((id) => id !== document.id),
                  );
                }}
              />
              <span className="truncate">{document.filename}</span>
            </label>
          ))}
          {contextLibraryDocs.length === 0 && (
            <span className="text-muted-foreground text-xs">
              Upload a .txt or .pdf below to use as context.
            </span>
          )}
        </div>
      )}

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
            placeholder="Message... (paste images)"
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
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  const image = await readFileAsBase64(file);
                  setPendingImages((previous) => [...previous, image]);
                }
                event.target.value = "";
              }}
            />
            <input
              ref={docInputRef}
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  if (user) uploadDocMutation.mutate(file);
                  else uploadGuestDocMutation.mutate(file);
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
              type="button"
              variant="outline"
              size="icon"
              disabled={
                isBusy ||
                isCreatingChat ||
                (user
                  ? uploadDocMutation.isPending
                  : uploadGuestDocMutation.isPending)
              }
              onClick={() => docInputRef.current?.click()}
              aria-label="Upload document"
              title="Upload .txt or .pdf"
            >
              <Paperclip className="h-4 w-4" />
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
