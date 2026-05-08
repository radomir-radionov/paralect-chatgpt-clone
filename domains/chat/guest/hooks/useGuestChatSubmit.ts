"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { AiModelSlug } from "@shared/lib/ai/model-registry";

import type { ComposerSubmitPayload } from "@domains/chat/room/components/ChatComposerInput";
import {
  clampGuestRemainingQuestions,
  parseGuestQuotaRemainingHeader,
} from "@domains/chat/guest/lib/guestChatClientQuota";
import {
  updateStoredGuestChat,
  type GuestMessage,
} from "@domains/chat/guest/lib/guestChatLocalStorage";
import { readTextStream } from "@domains/chat/streaming/lib/readTextStream";
import type {
  MessageAttachment,
  MessageStatus,
} from "@domains/chat/types/chat.types";

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

type UseGuestChatSubmitOptions = Readonly<{
  messages: GuestMessage[];
  modelSlug: AiModelSlug;
  setQuotaRemaining: (value: number) => void;
}>;

export function useGuestChatSubmit({
  messages,
  modelSlug,
  setQuotaRemaining,
}: UseGuestChatSubmitOptions) {
  const [isSending, setIsSending] = useState(false);

  const onSubmit = useCallback(
    async ({
      text,
      pendingImages,
      pendingDocuments,
      createdAt,
    }: ComposerSubmitPayload) => {
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
            nextRemainingFromBody = clampGuestRemainingQuestions(data.remaining);
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

      const nextRemaining = parseGuestQuotaRemainingHeader(
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
    },
    [messages, modelSlug, setQuotaRemaining],
  );

  return { isSending, onSubmit };
}
