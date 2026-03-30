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
import { AssistantMarkdown } from "@/components/chat/assistant-markdown";
import { useChatLayout } from "@/components/chat/chat-layout-context";
import { useChatShell } from "@/components/chat/chat-shell";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiJson, parseSseStream } from "@/lib/api-client";
import {
  fetchChatDetailPage,
  type ChatMessageAttachment,
  type ChatSummary,
} from "@/lib/chat-api";
import {
  appendOptimisticUserMessage,
  upsertChatInListCache,
} from "@/lib/chats-cache";
import { cn } from "@/lib/utils";

type ChatRow = ChatSummary;

function parseRowAttachments(
  raw: unknown,
): ChatMessageAttachment[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  const out: ChatMessageAttachment[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      "mimeType" in item &&
      "base64" in item &&
      typeof (item as ChatMessageAttachment).mimeType === "string" &&
      typeof (item as ChatMessageAttachment).base64 === "string"
    ) {
      out.push(item as ChatMessageAttachment);
    }
  }
  return out.length ? out : undefined;
}

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatMessageAttachment[];
};

type MessageBubbleProps = {
  m: UiMessage;
};

function MessageBubble({ m }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
        m.role === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground",
      )}
    >
      {m.attachments && m.attachments.length > 0 && (
        <div
          className={cn(
            "mb-2 flex flex-col gap-2",
            m.content ? "" : "mb-0",
          )}
        >
          {m.attachments.map((a, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`${m.id}-att-${i}`}
              src={`data:${a.mimeType};base64,${a.base64}`}
              alt=""
              className="max-h-64 max-w-full rounded-md object-contain"
            />
          ))}
        </div>
      )}
      {m.content ? (
        m.role === "assistant" ? (
          <AssistantMarkdown content={m.content} />
        ) : (
          m.content
        )
      ) : m.role === "assistant" ? (
        <span className="text-muted-foreground" aria-busy="true">
          …
        </span>
      ) : null}
    </div>
  );
}

export function ChatMain() {
  const params = useParams<{ chatId?: string }>();
  const chatId = typeof params.chatId === "string" ? params.chatId : undefined;
  const {
    user,
    authLoading,
    routingChatId,
    setRoutingChatId,
  } = useChatLayout();
  const { isCreatingChat } = useChatShell();
  const effectiveChatId = chatId ?? routingChatId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modelId, setModelId] = useState<string>("");
  const [guestMessages, setGuestMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [authStreamText, setAuthStreamText] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<
    { mimeType: string; base64: string; preview: string }[]
  >([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

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
    enabled: !user,
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
    enabled: !user,
  });

  const contextLibraryDocs = user
    ? documentsQuery.data?.documents
    : guestDocumentsQuery.data?.documents;

  const messages: UiMessage[] = useMemo(() => {
    if (!user) return guestMessages;
    const pages = chatDetailQuery.data?.pages;
    if (!pages?.length) return [];
    const chronological = [...pages].reverse().flatMap((p) => p.messages);
    return chronological.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      attachments: parseRowAttachments(m.attachments),
    }));
  }, [user, guestMessages, chatDetailQuery.data]);

  const displayMessages: UiMessage[] = useMemo(() => {
    if (authStreamText === null) return messages;
    const streamT = authStreamText.trim();
    const last = messages[messages.length - 1];
    if (
      last?.role === "assistant" &&
      last.content.trim() === streamT
    ) {
      return messages;
    }
    return [
      ...messages,
      {
        id: "__stream__",
        role: "assistant" as const,
        content: authStreamText,
      },
    ];
  }, [messages, authStreamText]);

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
          const j = JSON.parse(text) as { error?: unknown };
          if (typeof j.error === "string") message = j.error;
        } catch {
          /* keep text */
        }
        throw new Error(message || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ document: { id: string } }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => {
      setSendError(e instanceof Error ? e.message : "Upload failed");
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
          const j = JSON.parse(text) as { error?: unknown };
          if (typeof j.error === "string") message = j.error;
        } catch {
          /* keep text */
        }
        throw new Error(message || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ document: { id: string } }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guest-documents"] });
    },
    onError: (e) => {
      setSendError(e instanceof Error ? e.message : "Upload failed");
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
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const img = await readFileAsBase64(file);
            setPendingImages((p) => [...p, img]);
          }
        }
      }
    },
    [],
  );

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text && pendingImages.length === 0) return;
    if (!modelId && modelsQuery.data?.models?.length) {
      setModelId(modelsQuery.data.models[0]!.id);
    }
    const currentModel =
      modelId || modelsQuery.data?.models?.[0]?.id || "openai:gpt-4o-mini";
    const images =
      pendingImages.length > 0
        ? pendingImages.map(({ mimeType, base64 }) => ({ mimeType, base64 }))
        : undefined;

    setDraft("");
    setPendingImages((prev) => {
      for (const img of prev) {
        URL.revokeObjectURL(img.preview);
      }
      return [];
    });
    setSendError(null);
    setStreaming(true);

    try {
      if (!user) {
        const nextUser: UiMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: text || "(image)",
          attachments: images,
        };
        const history = [...guestMessages, nextUser];
        setGuestMessages(history);
        const assistantId = crypto.randomUUID();
        setGuestMessages((m) => [
          ...m,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const res = await fetch("/api/guest/stream", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: currentModel,
            messages: history.map((msg) => ({
              role: msg.role,
              content: msg.content,
              images: msg.id === nextUser.id ? images : undefined,
            })),
            documentIds: selectedDocIds.length ? selectedDocIds : undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            typeof err.error === "string" ? err.error : res.statusText,
          );
        }
        let acc = "";
        await parseSseStream(res, (chunk) => {
          acc += chunk;
          setGuestMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: acc } : msg,
            ),
          );
        });
        void queryClient.invalidateQueries({ queryKey: ["guest-quota"] });
        setSelectedDocIds([]);
        return;
      }

      let activeChatId = chatId;
      if (!activeChatId) {
        const created = await apiJson<{ chat: ChatRow }>("/api/chats", {
          method: "POST",
          body: JSON.stringify({ title: text.slice(0, 80) }),
        });
        const newChatId = created.chat.id;
        activeChatId = newChatId;
        upsertChatInListCache(queryClient, created.chat);
        await queryClient.fetchInfiniteQuery({
          queryKey: ["chat", newChatId],
          initialPageParam: undefined as string | undefined,
          queryFn: ({ pageParam }) =>
            fetchChatDetailPage(
              newChatId,
              pageParam ? { before: pageParam } : {},
            ),
        });
        setRoutingChatId(newChatId);
        router.replace(`/chat/${newChatId}`);
      }

      const res = await fetch(
        `/api/chats/${activeChatId}/messages/stream`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text || "What do you see in this image?",
            modelId: currentModel,
            images,
            documentIds: selectedDocIds.length ? selectedDocIds : undefined,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());

      setAuthStreamText("");

      appendOptimisticUserMessage(queryClient, activeChatId, {
        content: text || "What do you see in this image?",
        attachments: images ?? null,
      });

      await parseSseStream(res, (chunk) => {
        setAuthStreamText((prev) => (prev ?? "") + chunk);
      });

      // Refetch thread before clearing the stream overlay so the assistant row
      // exists in cache (avoids show → blank → show).
      await queryClient.refetchQueries({ queryKey: ["chat", activeChatId] });
      setAuthStreamText(null);
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      setSelectedDocIds([]);
    } catch (e) {
      console.error(e);
      setSendError(e instanceof Error ? e.message : "Failed to send");
      setAuthStreamText(null);
    } finally {
      setStreaming(false);
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
          {!user && (
            <span className="text-muted-foreground text-xs">
              {quotaQuery.isLoading
                ? "…"
                : `${quotaQuery.data?.remaining ?? "—"} free left`}
            </span>
          )}
          <label className="sr-only" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 max-w-[min(100vw-8rem,14rem)] rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={
              modelsQuery.isLoading || !modelsQuery.data?.models?.length
            }
          >
            {modelsQuery.data?.models?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {modelsQuery.isError && (
            <span className="text-destructive max-w-[10rem] truncate text-xs">
              Set LLM keys in .env
            </span>
          )}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        {authLoading ||
        (user && effectiveChatId && chatDetailQuery.isPending) ||
        (streaming && displayMessages.length === 0) ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-[80%]" />
            <Skeleton className="h-16 w-[70%] self-end" />
          </div>
        ) : displayMessages.length === 0 && !streaming ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-24 text-center">
            <p className="text-lg font-medium text-foreground">
              Start a conversation
            </p>
            <p className="max-w-sm text-sm">
              Ask a question or paste an image. When not signed in, you can add
              .txt/.pdf from the toolbar as context; sign in to keep chats and a
              larger document library.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-8">
            {user &&
              effectiveChatId &&
              chatDetailQuery.hasNextPage &&
              displayMessages.length > 0 && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={chatDetailQuery.isFetchingNextPage}
                    onClick={() => void chatDetailQuery.fetchNextPage()}
                  >
                    {chatDetailQuery.isFetchingNextPage
                      ? "Loading older messages…"
                      : "Load older messages"}
                  </Button>
                </div>
              )}
            {displayMessages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <MessageBubble m={m} />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {contextLibraryDocs && (
        <div className="border-sidebar-border flex flex-wrap gap-2 border-t px-4 py-2">
          <span className="text-muted-foreground w-full text-xs">
            Context documents
          </span>
          {contextLibraryDocs.map((d) => (
            <label
              key={d.id}
              className="flex cursor-pointer items-center gap-2 text-xs"
            >
              <input
                type="checkbox"
                checked={selectedDocIds.includes(d.id)}
                onChange={(e) => {
                  setSelectedDocIds((prev) =>
                    e.target.checked
                      ? [...prev, d.id]
                      : prev.filter((x) => x !== d.id),
                  );
                }}
              />
              <span className="truncate">{d.filename}</span>
            </label>
          ))}
          {contextLibraryDocs.length === 0 && (
            <span className="text-muted-foreground text-xs">
              Upload a .txt or .pdf below to use as context.
            </span>
          )}
        </div>
      )}

      <div className="border-sidebar-border bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky bottom-0 border-t p-4 backdrop-blur">
        {pendingImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingImages.map((img, i) => (
              <div key={img.preview} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt=""
                  className="h-16 w-16 rounded-md object-cover"
                />
                <button
                  type="button"
                  className="bg-background/90 absolute -top-1 -right-1 rounded-full p-0.5 text-xs"
                  onClick={() =>
                    setPendingImages((p) => {
                      const removed = p[i];
                      if (removed) URL.revokeObjectURL(removed.preview);
                      return p.filter((_, j) => j !== i);
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
            <p className="text-muted-foreground text-sm">Creating chat…</p>
          )}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={handlePasteImage}
            placeholder="Message… (paste images)"
            className="min-h-[96px] resize-none"
            disabled={streaming || isCreatingChat}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
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
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const img = await readFileAsBase64(file);
                  setPendingImages((p) => [...p, img]);
                }
                e.target.value = "";
              }}
            />
            <input
              ref={docInputRef}
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (user) uploadDocMutation.mutate(file);
                  else uploadGuestDocMutation.mutate(file);
                }
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={streaming || isCreatingChat}
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
                streaming ||
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
                streaming ||
                isCreatingChat ||
                (!draft.trim() && pendingImages.length === 0) ||
                modelsQuery.isError
              }
              onClick={() => void sendMessage()}
            >
              {streaming ? (
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
