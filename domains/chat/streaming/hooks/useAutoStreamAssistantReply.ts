"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { AiModelSlug } from "@shared/lib/ai/model-registry";
import { useStreamAssistantReply } from "@domains/chat/streaming/mutations/useStreamAssistantReply";
import type { CachedMessage } from "@domains/chat/types/chat.types";

/**
 * After a completed user message, starts `assistant_only` streaming unless a full send stream is in flight.
 */
export function useAutoStreamAssistantReply(options: {
  roomId: string;
  messages: CachedMessage[];
  modelSlug: AiModelSlug | undefined;
  roomSendStreamInFlight: number;
  streamAssistantReply: ReturnType<typeof useStreamAssistantReply>;
}) {
  const {
    roomId,
    messages,
    modelSlug,
    roomSendStreamInFlight,
    streamAssistantReply,
  } = options;

  const streamedUserMessageIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (roomSendStreamInFlight > 0) return;
    if (!modelSlug) return;

    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role !== "user") return;
    if (last.status === "pending" || last.status === "error") return;
    if (streamAssistantReply.isPending) return;

    if (streamedUserMessageIdsRef.current.has(last.id)) return;
    streamedUserMessageIdsRef.current.add(last.id);

    void (async () => {
      const result = await streamAssistantReply.mutateAsync({
        roomId,
        userMessageId: last.id,
        assistantId: crypto.randomUUID(),
        createdAt: last.created_at,
        modelSlug,
      });

      if (result.error) {
        toast.error(result.message);
      }
    })();
  }, [
    messages,
    modelSlug,
    roomId,
    roomSendStreamInFlight,
    streamAssistantReply,
  ]);
}
