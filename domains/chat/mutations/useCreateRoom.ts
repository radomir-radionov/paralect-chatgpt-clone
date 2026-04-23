"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type z from "zod";

import { createRoom } from "@domains/chat/actions/rooms";
import { chatKeys } from "@domains/chat/queries/keys";
import type { createRoomSchema } from "@domains/chat/schemas/rooms";

type CreateRoomInput = z.infer<typeof createRoomSchema>;

export function useCreateRoom(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoomInput) => createRoom(data),
    onSettled: async () => {
      if (!userId) return;

      await queryClient.invalidateQueries({
        queryKey: chatKeys.joinedRooms(userId),
      });
    },
  });
}
