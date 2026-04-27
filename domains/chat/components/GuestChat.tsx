"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@shared/components/ui/button";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";
import { cn } from "@shared/lib/utils";

import { ChatComposerInput } from "@domains/chat/components/ChatComposerInput";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
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
  remaining?: number;
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

function readStoredGuestChat(): StoredGuestChat | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredGuestChat;
    return parsed;
  } catch {
    return null;
  }
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

async function readTextStream(
  response: Response,
  onChunk: (chunk: string) => void,
) {
  if (response.body == null) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) onChunk(decoder.decode(value, { stream: true }));
  }

  const remainder = decoder.decode();
  if (remainder) onChunk(remainder);
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
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [remainingQuestions, setRemainingQuestions] = useState(
    GUEST_FREE_QUESTION_LIMIT,
  );
  const [modelSlug, setModelSlug] = useState<AiModelSlug>(
    DEFAULT_AI_MODEL_SLUG,
  );
  const [isSending, setIsSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const hasReachedQuestionLimit = remainingQuestions <= 0;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = readStoredGuestChat();

      if (stored?.messages) {
        setMessages(stored.messages);
      }

      if (typeof stored?.remaining === "number") {
        setRemainingQuestions(clampRemainingQuestions(stored.remaining));
      }

      if (
        stored?.modelSlug &&
        AI_MODELS.some((model) => model.slug === stored.modelSlug)
      ) {
        setModelSlug(stored.modelSlug);
      }

      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncQuotaFromServer() {
      try {
        const response = await fetch("/api/guest/quota", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as GuestQuotaResponse;
        if (!cancelled && !data.error) {
          setRemainingQuestions(clampRemainingQuestions(data.remaining));
        }
      } catch {
        // Keep the local quota state if the status request fails.
      }
    }

    void syncQuotaFromServer();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages,
        remaining: remainingQuestions,
        modelSlug,
      } satisfies StoredGuestChat),
    );
  }, [hydrated, messages, modelSlug, remainingQuestions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              <Link href="/">AI Chat</Link>
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="hidden text-xs text-muted-foreground sm:block">
              Model
            </label>
            <select
              value={modelSlug}
              onChange={(e) => setModelSlug(e.target.value as AiModelSlug)}
              disabled={isSending}
              className={cn(
                "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                "focus-visible:ring-[3px]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "w-[220px] max-w-[52vw]",
              )}
              aria-label="AI model"
            >
              {AI_MODELS.map((model) => (
                <option key={model.slug} value={model.slug}>
                  {model.label}
                </option>
              ))}
            </select>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="w-full max-w-2xl -translate-y-16">
              <p className="text-2xl font-semibold tracking-tight">
                Ask your first question.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try Paralect Chat with {GUEST_FREE_QUESTION_LIMIT} free
                questions. Sign in anytime to save your history.
              </p>
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

      {hasReachedQuestionLimit && (
        <div className="border-t px-4 pt-3">
          <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">You have used your 3 free questions.</p>
            <p className="mt-1 text-muted-foreground">
              Sign in to keep chatting and save your conversation history.
            </p>
            <Link
              href="/login"
              className={buttonVariants({ size: "sm", className: "mt-3" })}
            >
              Sign in or create account
            </Link>
          </div>
        </div>
      )}

      <ChatComposerInput
        disabled={isSending || hasReachedQuestionLimit}
        isSending={isSending}
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

          setMessages((current) => [...current, userMessage, assistantMessage]);
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
                messages: [...messages, userMessage].map((item) => ({
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
            setMessages((current) =>
              current.map((item) =>
                item.id === userMessageId || item.id === assistantMessageId
                  ? { ...item, status: "error" }
                  : item,
              ),
            );
            setIsSending(false);
            return;
          }

          if (!response.ok) {
            let errorMessage = "Failed to send message";
            try {
              const data = (await response.json()) as {
                message?: string;
                remaining?: number;
              };
              if (typeof data.message === "string") errorMessage = data.message;
              if (typeof data.remaining === "number") {
                setRemainingQuestions(clampRemainingQuestions(data.remaining));
              }
            } catch {
              // ignore
            }

            toast.error(errorMessage);
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessageId
                  ? { ...item, text: errorMessage, status: "error" }
                  : item.id === userMessageId
                    ? { ...item, status: "error" }
                    : item,
              ),
            );
            setIsSending(false);
            return;
          }

          const nextRemaining = parseRemainingHeader(
            response.headers.get("X-Guest-Questions-Remaining"),
          );
          if (nextRemaining != null) {
            setRemainingQuestions(nextRemaining);
          }

          let receivedText = "";
          let queuedText = "";
          let scheduled = false;

          const flush = () => {
            scheduled = false;
            if (!queuedText) return;
            receivedText += queuedText;
            queuedText = "";
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessageId
                  ? { ...item, text: receivedText, status: "pending" }
                  : item,
              ),
            );
          };

          try {
            await readTextStream(response, (chunk) => {
              queuedText += chunk;
              if (scheduled) return;
              scheduled = true;
              requestAnimationFrame(flush);
            });

            flush();
            setMessages((current) =>
              current.map((item) =>
                item.id === userMessageId || item.id === assistantMessageId
                  ? { ...item, status: "success" }
                  : item,
              ),
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Streaming response failed";
            toast.error(errorMessage);
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessageId
                  ? { ...item, text: receivedText, status: "error" }
                  : item.id === userMessageId
                    ? { ...item, status: "error" }
                    : item,
              ),
            );
          } finally {
            setIsSending(false);
          }
        }}
      />
    </div>
  );
}
