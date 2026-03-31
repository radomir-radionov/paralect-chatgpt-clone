"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import type { ChatSummary } from "@/lib/chat-api";
import { removeChatFromListCache } from "@/lib/chats-cache";
import { invalidateChatsListDebounced } from "@/lib/invalidate-chats-list";
import type { RouteSyncIntent } from "@/types/chat-route-sync";

type DeleteMutationContext = {
  previousChats: { chats: ChatSummary[] } | undefined;
  navigatedAway: boolean;
};

type UseDeleteChatMutationArgs = {
  chatId: string | undefined;
  routingChatId: string | undefined;
  setPendingRouteSync: Dispatch<SetStateAction<RouteSyncIntent | null>>;
};

export function useDeleteChatMutation({
  chatId,
  routingChatId,
  setPendingRouteSync,
}: UseDeleteChatMutationArgs) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/chats/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          res.status === 404 ? "Chat not found" : `Delete failed (${res.status})`,
        );
      }
    },
    onMutate: async (id): Promise<DeleteMutationContext> => {
      const previousChats = queryClient.getQueryData<{ chats: ChatSummary[] }>([
        "chats",
      ]);
      // Apply list removal synchronously so the row disappears before any await.
      removeChatFromListCache(queryClient, id);
      void queryClient.cancelQueries({ queryKey: ["chats"] });

      const current = chatId ?? routingChatId;
      const navigatedAway = current === id;
      const fallbackChatId =
        previousChats?.chats.find((chat) => chat.id !== id)?.id;
      if (navigatedAway) {
        queryClient.removeQueries({ queryKey: ["chat", id] });
        void queryClient.cancelQueries({ queryKey: ["chat", id] });
        setPendingRouteSync({
          kind: "clear",
          navigation: {
            method: "push",
            href: fallbackChatId ? `/chat/${fallbackChatId}` : "/chat",
          },
        });
      }
      return { previousChats, navigatedAway };
    },
    onError: (_err, id, context) => {
      if (context?.previousChats !== undefined) {
        queryClient.setQueryData(["chats"], context.previousChats);
      } else {
        invalidateChatsListDebounced(queryClient);
      }
      if (context?.navigatedAway) {
        router.replace(`/chat/${id}`);
      }
    },
  });
}
