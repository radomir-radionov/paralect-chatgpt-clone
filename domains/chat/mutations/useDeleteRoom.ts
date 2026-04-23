"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteRoom } from "@domains/chat/actions/rooms";
import { chatKeys } from "@domains/chat/queries/keys";

export function useDeleteRoom(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId }: { roomId: string }) => deleteRoom({ roomId }),
    onSuccess: async (result, variables) => {
      if (result.error) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.joinedRooms(userId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.room(variables.roomId) }),
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(variables.roomId),
        }),
      ]);
    },
  });
}

