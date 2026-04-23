"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type z from "zod";

import { startRoomWithFirstMessage } from "@domains/chat/actions/rooms";
import { chatKeys } from "@domains/chat/queries/keys";
import type { startRoomWithFirstMessageSchema } from "@domains/chat/schemas/rooms";

type Input = z.infer<typeof startRoomWithFirstMessageSchema>;

type Result =
  | { error: false; roomId: string }
  | { error: true; message: string; roomId?: string };

export function useStartRoomWithFirstMessage(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<Result, Error, Input>({
    mutationFn: (data) => startRoomWithFirstMessage(data),
    onSettled: async () => {
      if (!userId) return;
      await queryClient.invalidateQueries({
        queryKey: chatKeys.joinedRooms(userId),
      });
    },
  });
}

