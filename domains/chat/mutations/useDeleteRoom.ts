"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clientDeleteRoom } from "@domains/chat/queries/clientChatFetchers";
import { chatKeys } from "@domains/chat/queries/keys";
import type { RoomListItem } from "@domains/chat/queries/useRooms";
import { broadcastChatInvalidation } from "@shared/lib/query/chatCrossTabSync";

type DeleteRoomContext = {
  previousJoined: RoomListItem[] | undefined;
};

export function useDeleteRoom(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId }: { roomId: string }) => clientDeleteRoom(roomId),
    onMutate: async ({ roomId }): Promise<DeleteRoomContext> => {
      await queryClient.cancelQueries({
        queryKey: chatKeys.joinedRooms(userId),
      });

      const previousJoined = queryClient.getQueryData<RoomListItem[]>(
        chatKeys.joinedRooms(userId),
      );

      queryClient.setQueryData<RoomListItem[]>(
        chatKeys.joinedRooms(userId),
        (old) => (Array.isArray(old) ? old.filter((r) => r.id !== roomId) : old),
      );

      return { previousJoined };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousJoined !== undefined) {
        queryClient.setQueryData(
          chatKeys.joinedRooms(userId),
          context.previousJoined,
        );
      }
    },
    onSuccess: async (result, variables, context) => {
      if (result.error) {
        if (context?.previousJoined !== undefined) {
          queryClient.setQueryData(
            chatKeys.joinedRooms(userId),
            context.previousJoined,
          );
        }
        return;
      }

      await queryClient.cancelQueries({
        queryKey: chatKeys.room(variables.roomId),
      });
      await queryClient.cancelQueries({
        queryKey: chatKeys.messages(variables.roomId),
      });
      queryClient.removeQueries({ queryKey: chatKeys.room(variables.roomId) });
      queryClient.removeQueries({
        queryKey: chatKeys.messages(variables.roomId),
      });

      await queryClient.invalidateQueries({
        queryKey: chatKeys.joinedRooms(userId),
      });

      broadcastChatInvalidation({ roomId: variables.roomId });
    },
  });
}
