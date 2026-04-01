"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ImageIcon, Loader2, Send, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { toThreadMessage } from "@/components/chat/chat-thread.types";
import { shouldPollPendingSync } from "@/components/chat/thread-state";
import { useChatThreadState } from "@/components/chat/use-chat-thread-state";
import { useChatLayout } from "@/components/chat/chat-layout-context";
import { useChatShell } from "@/components/chat/chat-shell";
import {
  buildSendContext,
  getChatKey,
  sendAuthMessage,
  sendGuestMessage,
} from "@/components/chat/chat-main.send";
import {
  getContextDocumentStatusHint,
  MAX_DOCS_PER_MESSAGE,
  useChatContextDocuments,
} from "@/components/chat/chat-main.documents";
import { useChatComposer } from "@/components/chat/use-chat-composer";
import { usePendingThreadSync } from "@/components/chat/use-pending-thread-sync";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/api-client";
import {
  CHAT_IMAGE_ACCEPT_ATTR,
} from "@/lib/image-attachment";
import {
  isChatNotFoundError,
  toUserFacingChatErrorMessage,
} from "@/lib/chat-error";
import { fetchChatDetailPage } from "@/lib/chat-api";
import { getChatApiSurface } from "@/lib/chat-session";

export function ChatMain() {
  const params = useParams<{ chatId?: string }>();
  const chatId = typeof params.chatId === "string" ? params.chatId : undefined;
  const { session, routingChatId, setRoutingChatId } = useChatLayout();
  const { isCreatingChat } = useChatShell();
  const effectiveChatId = chatId ?? routingChatId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = session.role === "user" ? session.user : null;
  const authLoading = session.status === "loading";
  const isGuestMode = session.status === "guest";
  const apiSurface = getChatApiSurface(session);
  const [modelId, setModelId] = useState<string>("");
  const [sendError, setSendError] = useState<string | null>(null);
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
        apiSurface.quotaPath!,
      ),
    enabled: isGuestMode,
  });

  const {
    docList,
    selectedDocumentIds,
    toggleDocumentSelection,
    clearSelection: clearDocumentSelection,
    handleDocumentUpload,
    handleDeleteContextDocument,
  } = useChatContextDocuments({
    apiSurface,
    enabled: session.status !== "loading",
    queryClient,
    setSendError,
  });

  const {
    draft,
    setDraft,
    pendingImages,
    handlePasteImage,
    handleImageFileInputChange,
    removePendingImage,
    resetAfterSend,
  } = useChatComposer({ setSendError });

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
    : session.status === "guest"
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
    mode: session.status === "guest" ? "guest" : "auth",
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

  usePendingThreadSync({
    effectiveChatId,
    shouldSyncPendingThread,
    chatDetailNotFound,
    queryClient,
    router,
  });

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
    resetAfterSend();

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
        clearDocumentSelection();
      }
    };

    try {
      if (isGuestMode) {
        await sendGuestMessage({
          ctx,
          messages,
          streamController,
          queryClient,
          thread: { startSend, appendAssistantChunk, completeAssistant },
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
        queryClient,
        router,
        setRoutingChatId,
        thread: { startSend, moveThread, appendAssistantChunk, completeAssistant },
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
                  onClick={() => removePendingImage(index)}
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
          {session.status !== "loading" && docList.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-2">
                {docList.map((doc) => {
                  const ready = doc.status === "ready";
                  const checked = selectedDocumentIds.includes(doc.id);
                  const statusHint = getContextDocumentStatusHint(doc);
                  return (
                    <div
                      key={doc.id}
                      className={`flex max-w-full min-w-0 items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                        ready ? "" : "opacity-60"
                      }`}
                    >
                      <label
                        className={`flex min-w-0 flex-1 items-center gap-1.5 ${
                          ready
                            ? "cursor-pointer"
                            : "cursor-not-allowed"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="shrink-0"
                          disabled={!ready || isBusy}
                          checked={checked}
                          onChange={() => toggleDocumentSelection(doc.id)}
                        />
                        <span className="min-w-0 truncate">{doc.filename}</span>
                        {statusHint.text ? (
                          <span
                            className="text-muted-foreground min-w-0 shrink truncate"
                            title={statusHint.title}
                          >
                            {statusHint.text}
                          </span>
                        ) : null}
                      </label>
                      {doc.status === "failed" && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5"
                          title="Remove from library"
                          disabled={isBusy}
                          onClick={() => void handleDeleteContextDocument(doc.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          <span className="sr-only">Remove document</span>
                        </button>
                      )}
                    </div>
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
          {session.role === "user" && isCreatingChat && (
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
            {session.status !== "loading" && (
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
              onChange={handleImageFileInputChange}
            />
            {session.status !== "loading" && (
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
