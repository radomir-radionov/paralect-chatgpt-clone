"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@shared/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shared/components/ui/empty";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";
import { cn } from "@shared/lib/utils";

import { AiModelSelect } from "@domains/chat/components/AiModelSelect";
import { ChatComposerInput } from "@domains/chat/components/ChatComposerInput";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { readTextStream } from "@domains/chat/lib/readTextStream";
import { GUEST_FREE_QUESTION_LIMIT } from "@domains/chat/lib/guestQuotaConstants";
import type {
  MessageAttachment,
  MessageStatus,
} from "@domains/chat/types/chat.types";

const STORAGE_KEY = "paralect_guest_chat";

type GuestMessage = {
  id: string;
  text: string;
  created_at: string;
  role: "assistant" | "user";
  attachments?: MessageAttachment[];
  status?: MessageStatus;
};

type StoredGuestChat = {
  messages?: GuestMessage[];
  modelSlug?: AiModelSlug;
};

type GuestQuotaResponse =
  | {
      error: false;
      remaining: number;
      usedQuestions: number;
    }
  | {
      error: true;
      message: string;
    };

const EMPTY_MESSAGES: ReadonlyArray<GuestMessage> = [];

const guestChatListeners = new Set<() => void>();

function subscribeGuestChat(callback: () => void) {
  guestChatListeners.add(callback);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    guestChatListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getGuestChatSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function getGuestChatServerSnapshot(): string | null {
  return null;
}

function parseStoredGuestChat(raw: string | null): StoredGuestChat | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredGuestChat> & {
      remaining?: unknown;
      [key: string]: unknown;
    };

    // Keep localStorage schema stable: only persist fields we actually use.
    // This also drops legacy fields like `remaining`.
    return {
      ...(Array.isArray(parsed.messages) ? { messages: parsed.messages } : {}),
      ...(typeof parsed.modelSlug === "string"
        ? { modelSlug: parsed.modelSlug as AiModelSlug }
        : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Mutate the persisted guest chat in localStorage and notify all
 * `useSyncExternalStore` subscribers so React schedules a re-render.
 *
 * This replaces the old write `useEffect`: callers update storage at the
 * point of mutation and React state stays in sync via the subscription.
 */
function updateStoredGuestChat(
  updater: (prev: StoredGuestChat) => StoredGuestChat,
) {
  if (typeof window === "undefined") return;

  const prev =
    parseStoredGuestChat(window.localStorage.getItem(STORAGE_KEY)) ?? {};
  const next = updater(prev);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  for (const cb of guestChatListeners) cb();
}

function parseRemainingHeader(value: string | null) {
  if (value == null) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;

  return Math.max(0, Math.min(GUEST_FREE_QUESTION_LIMIT, parsed));
}

function clampRemainingQuestions(value: number) {
  if (!Number.isFinite(value)) return GUEST_FREE_QUESTION_LIMIT;
  return Math.max(0, Math.min(GUEST_FREE_QUESTION_LIMIT, Math.trunc(value)));
}

async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return window.btoa(binary);
}

export function GuestChat() {
  const storedRaw = useSyncExternalStore(
    subscribeGuestChat,
    getGuestChatSnapshot,
    getGuestChatServerSnapshot,
  );

  const stored = useMemo(() => parseStoredGuestChat(storedRaw), [storedRaw]);

  // `false` during SSR + first client render, `true` after hydration.
  // Used to delay the empty-state marketing copy until storage has been read.
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const messages = (stored?.messages ?? EMPTY_MESSAGES) as GuestMessage[];
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const modelSlug =
    stored?.modelSlug &&
    AI_MODELS.some((model) => model.slug === stored.modelSlug)
      ? stored.modelSlug
      : DEFAULT_AI_MODEL_SLUG;

  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const remainingQuestions = clampRemainingQuestions(
    quotaRemaining ?? GUEST_FREE_QUESTION_LIMIT,
  );
  const hasReachedQuestionLimit = remainingQuestions <= 0;

  useEffect(() => {
    let cancelled = false;

    async function loadQuotaFromServer() {
      try {
        const response = await fetch("/api/guest/quota", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as GuestQuotaResponse;
        if (!cancelled && !data.error) {
          setQuotaRemaining(clampRemainingQuestions(data.remaining));
        }
      } catch {
        // Keep the local quota state if the status request fails.
      }
    }

    void loadQuotaFromServer();

    return () => {
      cancelled = true;
    };
  }, []);

  const lastMessage = messages.at(-1);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages.length, lastMessage?.text, lastMessage?.status]);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex w-full min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-0">
          <div className="min-w-0 flex-1 basis-32 sm:flex-none">
            <h1 className="truncate text-lg font-semibold leading-none tracking-tight text-foreground">
              <Link href="/">AI Chat</Link>
            </h1>
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              variant="outline"
              size="lg"
              className="shrink-0 sm:hidden"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto">
            <AiModelSelect
              value={modelSlug}
              onChange={(next) =>
                updateStoredGuestChat((prev) => ({ ...prev, modelSlug: next }))
              }
              disabled={isSending}
              className={cn(
                "min-w-0",
                "min-w-[160px] w-full flex-1 max-w-none sm:w-[220px] sm:max-w-none sm:flex-none",
              )}
            />
            <Button
              variant="outline"
              size="lg"
              className="hidden shrink-0 sm:inline-flex"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <div
        className="relative flex-1 min-h-0 overflow-y-auto"
        aria-busy={!isHydrated}
      >
        {!isHydrated ? (
          <div className="h-full min-h-[40vh]" />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end px-3 pb-2 pt-2 sm:justify-center sm:px-0 sm:pb-3">
            <div className="flex w-full justify-center">
              <div className="w-full max-w-[800px] sm:px-4">
                <Empty className="border-0 bg-transparent py-10">
                  <EmptyHeader>
                    <EmptyTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                      Ask your first question.
                    </EmptyTitle>
                    <EmptyDescription className="mt-1">
                      Try Paralect Chat with {GUEST_FREE_QUESTION_LIMIT} free
                      questions. Sign in anytime to save your history.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((item) => (
              <ChatMessage
                key={item.id}
                id={item.id}
                text={item.text}
                created_at={item.created_at}
                author_id={item.role === "user" ? "guest" : null}
                role={item.role}
                author={{
                  name: item.role === "user" ? "You" : "Assistant",
                  image_url: null,
                }}
                attachments={item.attachments}
                isOwn={item.role === "user"}
                status={item.status}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {isHydrated && hasReachedQuestionLimit && (
        <div className="border-t px-3 pt-3 sm:px-4">
          <div className="mx-auto mb-3 max-w-[800px] rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">You have used your 3 free questions.</p>
            <p className="mt-1 text-muted-foreground">
              Sign in to keep chatting and save your conversation history.
            </p>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "mt-3",
              })}
            >
              Sign in or create account
            </Link>
          </div>
        </div>
      )}

      <ChatComposerInput
        disabled={isSending || hasReachedQuestionLimit}
        isSending={isSending}
        innerClassName="mx-auto max-w-[800px]"
        placeholder={
          hasReachedQuestionLimit ? "Sign in to ask more" : "Ask anything…"
        }
        onSubmit={async ({
          text,
          pendingImages,
          pendingDocuments,
          createdAt,
        }) => {
          const userMessageId = crypto.randomUUID();
          const assistantMessageId = crypto.randomUUID();

          const userAttachments: MessageAttachment[] = [
            ...pendingImages.map((img) => ({
              id: img.id,
              kind: "image" as const,
              mime_type: img.file.type || "application/octet-stream",
              size_bytes: img.file.size,
              width: null,
              height: null,
              preview_url: img.previewUrl,
            })),
            ...pendingDocuments.map((doc) => ({
              id: doc.id,
              kind: "document" as const,
              mime_type: doc.file.type || "application/octet-stream",
              size_bytes: doc.file.size,
              width: null,
              height: null,
              original_name: doc.file.name,
            })),
          ];

          const userMessage: GuestMessage = {
            id: userMessageId,
            text,
            created_at: createdAt,
            role: "user",
            attachments:
              userAttachments.length > 0 ? userAttachments : undefined,
            status: "pending",
          };
          const assistantMessage: GuestMessage = {
            id: assistantMessageId,
            text: "",
            created_at: createdAt,
            role: "assistant",
            status: "pending",
          };

          const previousMessages = messages;

          updateStoredGuestChat((prev) => ({
            ...prev,
            messages: [...(prev.messages ?? []), userMessage, assistantMessage],
          }));
          setIsSending(true);

          const outgoingAttachments = await Promise.all([
            ...pendingImages.map(async (img) => ({
              kind: "image" as const,
              mimeType: img.file.type || "application/octet-stream",
              sizeBytes: img.file.size,
              dataBase64: await fileToBase64(img.file),
            })),
            ...pendingDocuments.map(async (doc) => ({
              kind: "document" as const,
              mimeType: doc.file.type || "application/octet-stream",
              sizeBytes: doc.file.size,
              originalName: doc.file.name,
              dataBase64: await fileToBase64(doc.file),
            })),
          ]);

          let response: Response;
          try {
            response = await fetch("/api/guest/messages/stream", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                modelSlug,
                messages: [...previousMessages, userMessage].map((item) => ({
                  role: item.role,
                  text: item.text,
                })),
                attachments: outgoingAttachments,
              }),
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Failed to send message";
            toast.error(errorMessage);
            updateStoredGuestChat((prev) => ({
              ...prev,
              messages: (prev.messages ?? []).map((item) =>
                item.id === userMessageId || item.id === assistantMessageId
                  ? { ...item, status: "error" as MessageStatus }
                  : item,
              ),
            }));
            setIsSending(false);
            return;
          }

          if (!response.ok) {
            let errorMessage = "Failed to send message";
            let nextRemainingFromBody: number | null = null;
            try {
              const data = (await response.json()) as {
                message?: string;
                remaining?: number;
              };
              if (typeof data.message === "string") errorMessage = data.message;
              if (typeof data.remaining === "number") {
                nextRemainingFromBody = clampRemainingQuestions(data.remaining);
              }
            } catch {
              // ignore
            }

            toast.error(errorMessage);
            if (nextRemainingFromBody != null) {
              setQuotaRemaining(nextRemainingFromBody);
            }
            updateStoredGuestChat((prev) => ({
              ...prev,
              messages: (prev.messages ?? []).map((item) =>
                item.id === assistantMessageId
                  ? {
                      ...item,
                      text: errorMessage,
                      status: "error" as MessageStatus,
                    }
                  : item.id === userMessageId
                    ? { ...item, status: "error" as MessageStatus }
                    : item,
              ),
            }));
            setIsSending(false);
            return;
          }

          const nextRemaining = parseRemainingHeader(
            response.headers.get("X-Guest-Questions-Remaining"),
          );
          if (nextRemaining != null) {
            setQuotaRemaining(nextRemaining);
          }

          let receivedText = "";
          let queuedText = "";
          let scheduled = false;

          const flush = () => {
            scheduled = false;
            if (!queuedText) return;
            receivedText += queuedText;
            queuedText = "";
            updateStoredGuestChat((prev) => ({
              ...prev,
              messages: (prev.messages ?? []).map((item) =>
                item.id === assistantMessageId
                  ? {
                      ...item,
                      text: receivedText,
                      status: "pending" as MessageStatus,
                    }
                  : item,
              ),
            }));
          };

          try {
            await readTextStream(response, (chunk) => {
              queuedText += chunk;
              if (scheduled) return;
              scheduled = true;
              requestAnimationFrame(flush);
            });

            flush();
            updateStoredGuestChat((prev) => ({
              ...prev,
              messages: (prev.messages ?? []).map((item) =>
                item.id === userMessageId || item.id === assistantMessageId
                  ? { ...item, status: "success" as MessageStatus }
                  : item,
              ),
            }));
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Streaming response failed";
            toast.error(errorMessage);
            updateStoredGuestChat((prev) => ({
              ...prev,
              messages: (prev.messages ?? []).map((item) =>
                item.id === assistantMessageId
                  ? {
                      ...item,
                      text: receivedText,
                      status: "error" as MessageStatus,
                    }
                  : item.id === userMessageId
                    ? { ...item, status: "error" as MessageStatus }
                    : item,
              ),
            }));
          } finally {
            setIsSending(false);
          }
        }}
      />
    </div>
  );
}
