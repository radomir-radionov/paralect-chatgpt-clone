"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clientDeleteRoom } from "@domains/chat/queries/clientChatFetchers";
import { chatKeys } from "@domains/chat/queries/keys";
import { broadcastChatInvalidation } from "@shared/lib/query/chatCrossTabSync";

export function useDeleteRoom(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId }: { roomId: string }) => clientDeleteRoom(roomId),
    onSuccess: async (result, variables) => {
      if (result.error) return;
      await queryClient.invalidateQueries({
        queryKey: chatKeys.joinedRooms(userId),
      });

      broadcastChatInvalidation({ roomId: variables.roomId });
    },
  });
}
