"use client";

import { useIsMutating } from "@tanstack/react-query";

/** Count of `useSendMessage` stream mutations currently running for this room. */
export function useRoomStreamInFlightCount(roomId: string) {
  return useIsMutating({
    predicate: (mutation) => {
      const key = mutation.options.mutationKey;
      if (!Array.isArray(key)) return false;
      if (key[0] !== "chat" || key[1] !== "messages" || key[2] !== "stream") {
        return false;
      }
      const variables = mutation.state.variables as unknown;
      if (variables == null || typeof variables !== "object") return false;
      return (variables as { roomId?: unknown }).roomId === roomId;
    },
  });
}
