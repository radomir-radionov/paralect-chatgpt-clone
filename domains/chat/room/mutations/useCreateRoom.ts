"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { z } from "zod";

import { clientCreateRoom } from "@domains/chat/room/queries/clientChatFetchers";
import { chatKeys } from "@domains/chat/room/queries/keys";
import type { createRoomSchema } from "@domains/chat/room/schemas/rooms";
import { broadcastChatRoomsInvalidation } from "@shared/lib/query/chatCrossTabSync";

type CreateRoomInput = z.infer<typeof createRoomSchema>;

export function useCreateRoom(userId: string | null) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreateRoomInput) => clientCreateRoom(data),
    onSuccess: async (result) => {
      if (result.error) return;
      if (!userId) return;

      await queryClient.invalidateQueries({
        queryKey: chatKeys.joinedRooms(userId),
      });

      broadcastChatRoomsInvalidation();
      router.push(`/rooms/${result.roomId}`);
    },
  });
}
