"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type z from "zod";

import { updateRoomModel } from "@domains/chat/actions/rooms";
import { chatKeys } from "@domains/chat/queries/keys";
import type { RoomDetails } from "@domains/chat/queries/useRooms";
import type { updateRoomModelSchema } from "@domains/chat/schemas/rooms";
import { broadcastChatInvalidation } from "@shared/lib/query/chatCrossTabSync";

type UpdateRoomModelInput = z.infer<typeof updateRoomModelSchema>;

export function useUpdateRoomModel(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRoomModelInput) => updateRoomModel(data),
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: chatKeys.room(variables.roomId) }),
        queryClient.cancelQueries({ queryKey: chatKeys.joinedRooms(userId) }),
      ]);

      const previousRoom = queryClient.getQueryData<RoomDetails | null>(
        chatKeys.room(variables.roomId),
      );

      if (previousRoom) {
        queryClient.setQueryData<RoomDetails>(chatKeys.room(variables.roomId), {
          ...previousRoom,
          modelSlug: variables.modelSlug,
        });
      }

      return { previousRoom };
    },
    onError: (_err, variables, context) => {
      if (context?.previousRoom) {
        queryClient.setQueryData<RoomDetails>(
          chatKeys.room(variables.roomId),
          context.previousRoom,
        );
      }
    },
    onSuccess: async (result, variables) => {
      if (result.error) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: chatKeys.room(variables.roomId),
        }),
        queryClient.invalidateQueries({
          queryKey: chatKeys.joinedRooms(userId),
        }),
      ]);

      broadcastChatInvalidation({ roomId: variables.roomId });
    },
  });
}

