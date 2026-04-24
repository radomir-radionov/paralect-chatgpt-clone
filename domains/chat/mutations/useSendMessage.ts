"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { chatKeys } from "@domains/chat/queries/keys";
import {
  appendOptimisticMessage,
  applyMessageStatus,
  replaceMessage,
} from "@domains/chat/queries/messagesCache";
import type { Message, MessageAttachment } from "@domains/chat/types/chat.types";
import { broadcastChatInvalidation } from "@shared/lib/query/chatCrossTabSync";

type SendMessageInput = {
  id: string;
  assistantId: string;
  text: string;
  roomId: string;
  createdAt: string;
  attachments?: Array<
    Pick<MessageAttachment, "id" | "kind" | "mime_type" | "size_bytes" | "width" | "height"> & {
      storagePath: string;
      preview_url?: string;
    }
  >;
  author: {
    id: string;
    name: string;
    image_url: string | null;
  };
};

type SendMessageResult =
  | { error: false }
  | { error: true; message: string; userMessage?: Message };

const CHAT_PACING_ENABLED = process.env.NEXT_PUBLIC_CHAT_PACING !== "0";

type PaceOptions = Readonly<{
  minDurationMs: number;
  baselineCharsPerSec: number;
  maxDurationMs: number;
}>;

async function paceAssistantReveal(options: {
  readonly roomId: string;
  readonly assistantId: string;
  readonly createdAt: string;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly getReceivedText: () => string;
  readonly streamDone: () => boolean;
  readonly pacing: PaceOptions;
}): Promise<void> {
  const startedAt = performance.now();
  const { pacing } = options;

  let renderedText = "";
  let rafId: number | null = null;
  let resolvePromise: (() => void) | null = null;

  let lastFrameAt = startedAt;
  let desiredDoneAt: number | null = null;
  let finalTotalChars: number | null = null;

  const applyRendered = (text: string) => {
    replaceMessage(options.queryClient, options.roomId, {
      id: options.assistantId,
      text,
      created_at: options.createdAt,
      author_id: null,
      role: "assistant",
      author: { name: "Assistant", image_url: null },
      status: "pending",
    });
  };

  const scheduleNext = () => {
    if (rafId != null) return;
    rafId = requestAnimationFrame(step);
  };

  const step = () => {
    rafId = null;

    const now = performance.now();
    const dtMs = Math.max(0, now - lastFrameAt);
    lastFrameAt = now;

    const receivedText = options.getReceivedText();

    if (options.streamDone() && desiredDoneAt == null) {
      finalTotalChars = receivedText.length;
      const baselineMs = (finalTotalChars / pacing.baselineCharsPerSec) * 1000;
      const durationMs = Math.min(
        pacing.maxDurationMs,
        Math.max(pacing.minDurationMs, baselineMs),
      );
      desiredDoneAt = startedAt + durationMs;
    }

    const remainingChars = receivedText.length - renderedText.length;
    if (remainingChars > 0) {
      let charsToReveal = 0;

      if (desiredDoneAt != null && finalTotalChars != null) {
        const remainingTimeMs = Math.max(1, desiredDoneAt - now);
        const rateCharsPerMs = remainingChars / remainingTimeMs;
        charsToReveal = Math.ceil(rateCharsPerMs * dtMs);
      } else {
        // While streaming is still in progress, reveal at a steady baseline rate.
        const rateCharsPerMs = options.pacing.baselineCharsPerSec / 1000;
        charsToReveal = Math.ceil(rateCharsPerMs * dtMs);
      }

      charsToReveal = Math.max(1, Math.min(remainingChars, charsToReveal));
      renderedText = receivedText.slice(0, renderedText.length + charsToReveal);
      applyRendered(renderedText);
    }

    const done =
      options.streamDone() &&
      renderedText.length === options.getReceivedText().length &&
      (desiredDoneAt == null || now >= desiredDoneAt);

    if (done) {
      resolvePromise?.();
      resolvePromise = null;
      return;
    }

    scheduleNext();
  };

  scheduleNext();

  await new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    void reject;
  }).finally(() => {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    resolvePromise = null;
  });
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

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResult, Error, SendMessageInput>({
    mutationFn: async ({ id, assistantId, text, roomId, createdAt, attachments }) => {
      const url = `/api/rooms/${roomId}/messages/stream`;
      const bodyAttachments = attachments?.map((a) => ({
        id: a.id,
        kind: a.kind,
        storagePath: a.storagePath,
        mimeType: a.mime_type,
        sizeBytes: a.size_bytes,
        width: a.width ?? undefined,
        height: a.height ?? undefined,
      }));
      const body = JSON.stringify({ id, assistantId, text, attachments: bodyAttachments });

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch (network error)";
        return { error: true as const, message };
      }

      if (!response.ok) {
        let message = "Failed to send message";
        try {
          const data = (await response.json()) as { message?: string };
          if (typeof data.message === "string") message = data.message;
        } catch {
          // ignore
        }
        return { error: true as const, message };
      }

      let receivedText = "";
      let streamFinished = false;

      let queued = "";
      let scheduled = false;
      const flushNoPacing = () => {
        scheduled = false;
        if (!queued) return;
        receivedText += queued;
        queued = "";
        replaceMessage(queryClient, roomId, {
          id: assistantId,
          text: receivedText,
          created_at: createdAt,
          author_id: null,
          role: "assistant",
          author: { name: "Assistant", image_url: null },
          status: "pending",
        });
      };

      const pacingTask = CHAT_PACING_ENABLED
        ? paceAssistantReveal({
            roomId,
            assistantId,
            createdAt,
            queryClient,
            getReceivedText: () => receivedText,
            streamDone: () => streamFinished,
            pacing: {
              minDurationMs: 550,
              baselineCharsPerSec: 260,
              maxDurationMs: 1600,
            },
          })
        : Promise.resolve();

      try {
        await readTextStream(response, (chunk) => {
          if (CHAT_PACING_ENABLED) {
            receivedText += chunk;
            return;
          }

          queued += chunk;
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(flushNoPacing);
        });
      } catch (err) {
        replaceMessage(queryClient, roomId, {
          id: assistantId,
          text: receivedText,
          created_at: createdAt,
          author_id: null,
          role: "assistant",
          author: { name: "Assistant", image_url: null },
          status: "error",
        });

        const message =
          err instanceof Error ? err.message : "Streaming response failed";
        return { error: true as const, message };
      }

      streamFinished = true;
      if (!CHAT_PACING_ENABLED) flushNoPacing();
      await pacingTask;

      return { error: false as const };
    },
    onMutate: async ({
      id,
      assistantId,
      text,
      roomId,
      author,
      createdAt,
      attachments,
    }) => {
      appendOptimisticMessage(queryClient, roomId, {
        id,
        text,
        created_at: createdAt,
        author_id: author.id,
        role: "user",
        author: { name: author.name, image_url: author.image_url },
        attachments: attachments?.map((a) => ({
          id: a.id,
          kind: a.kind,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
          width: a.width ?? null,
          height: a.height ?? null,
          preview_url: a.preview_url,
        })),
        status: "pending",
      });

      appendOptimisticMessage(queryClient, roomId, {
        id: assistantId,
        text: "",
        created_at: createdAt,
        author_id: null,
        role: "assistant",
        author: { name: "Assistant", image_url: null },
        status: "pending",
      });
    },
    onSuccess: (result, variables) => {
      if (result.error) {
        if (result.userMessage) {
          replaceMessage(queryClient, variables.roomId, {
            ...result.userMessage,
            status: "success",
          });
          queryClient.invalidateQueries({
            queryKey: chatKeys.joinedRooms(variables.author.id),
          });

          broadcastChatInvalidation({ roomId: variables.roomId });
        } else {
          applyMessageStatus(queryClient, variables.roomId, variables.id, "error");
          applyMessageStatus(
            queryClient,
            variables.roomId,
            variables.assistantId,
            "error",
          );
        }
        return;
      }

      applyMessageStatus(queryClient, variables.roomId, variables.id, "success");
      applyMessageStatus(
        queryClient,
        variables.roomId,
        variables.assistantId,
        "success",
      );

      queryClient.invalidateQueries({
        queryKey: chatKeys.joinedRooms(variables.author.id),
      });

      queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.roomId) });

      broadcastChatInvalidation({ roomId: variables.roomId });
    },
    onError: (_err, variables) => {
      applyMessageStatus(queryClient, variables.roomId, variables.id, "error");
      applyMessageStatus(
        queryClient,
        variables.roomId,
        variables.assistantId,
        "error",
      );
    },
  });
}
