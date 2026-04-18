"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addUserToRoom } from "@domains/chat/actions/rooms";
import { chatKeys } from "@domains/chat/queries/keys";

type InviteUserInput = {
  roomId: string;
  userId: string;
};

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InviteUserInput) => addUserToRoom(input),
    onSuccess: async (result, { roomId }) => {
      if (result.error) return;
      await queryClient.invalidateQueries({ queryKey: chatKeys.room(roomId) });
    },
  });
}
