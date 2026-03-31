"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { apiJson } from "@/lib/api-client";
import type { ChatSummary } from "@/lib/chat-api";
import {
  primeNewChatDetailCache,
  upsertChatInListCache,
} from "@/lib/chats-cache";
import type { RouteSyncIntent } from "@/types/chat-route-sync";

export function useCreateChatMutation(
  setPendingRouteSync: Dispatch<SetStateAction<RouteSyncIntent | null>>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiJson<{ chat: ChatSummary }>("/api/chats", {
        method: "POST",
        body: JSON.stringify({}),
      });
      return res.chat;
    },
    onSuccess: (chat) => {
      upsertChatInListCache(queryClient, chat);
      primeNewChatDetailCache(queryClient, chat);
      setPendingRouteSync({
        kind: "select",
        chatId: chat.id,
        navigation: "replace",
      });
    },
  });
}
