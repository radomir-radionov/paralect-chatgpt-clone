"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { clientUpdateRoomModel } from "@domains/chat/room/queries/clientChatFetchers";
import { chatKeys } from "@domains/chat/room/queries/keys";
import type { RoomDetails } from "@domains/chat/room/queries/useRooms";
import type { RoomListItem } from "@domains/chat/room/queries/room-fetchers";
import type { updateRoomModelSchema } from "@domains/chat/room/schemas/rooms";
import { broadcastChatInvalidation } from "@shared/lib/query/chatCrossTabSync";

type UpdateRoomModelInput = z.infer<typeof updateRoomModelSchema>;

export function useUpdateRoomModel(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRoomModelInput) => clientUpdateRoomModel(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.room(variables.roomId) });

      const previousRoom = queryClient.getQueryData<RoomDetails | null>(
        chatKeys.room(variables.roomId),
      );

      const previousJoinedRooms = queryClient.getQueryData<RoomListItem[] | null>(
        chatKeys.joinedRooms(userId),
      );

      if (previousRoom) {
        queryClient.setQueryData<RoomDetails>(chatKeys.room(variables.roomId), {
          ...previousRoom,
          modelSlug: variables.modelSlug,
        });
      }

      if (previousJoinedRooms) {
        queryClient.setQueryData<RoomListItem[]>(
          chatKeys.joinedRooms(userId),
          previousJoinedRooms.map((room) =>
            room.id === variables.roomId ? { ...room, modelSlug: variables.modelSlug } : room,
          ),
        );
      }

      return { previousRoom, previousJoinedRooms };
    },
    onError: (_err, variables, context) => {
      if (context?.previousRoom) {
        queryClient.setQueryData<RoomDetails>(
          chatKeys.room(variables.roomId),
          context.previousRoom,
        );
      }

      if (context?.previousJoinedRooms) {
        queryClient.setQueryData<RoomListItem[]>(
          chatKeys.joinedRooms(userId),
          context.previousJoinedRooms,
        );
      }
    },
    onSuccess: async (result, variables) => {
      if (result.error) return;
      await queryClient.invalidateQueries({
        queryKey: chatKeys.room(variables.roomId),
      });

      broadcastChatInvalidation({ roomId: variables.roomId });
    },
  });
}
