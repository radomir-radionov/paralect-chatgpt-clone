"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { chatKeys } from "@domains/chat/queries/keys";

type JoinRoomInput = {
  roomId: string;
  userId: string;
};

export function useJoinRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, userId }: JoinRoomInput) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("chat_room_member").insert({
        chat_room_id: roomId,
        member_id: userId,
      });

      if (error) {
        throw new Error("Failed to join room");
      }
    },
    onSuccess: async (_data, { userId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.publicRooms }),
        queryClient.invalidateQueries({
          queryKey: chatKeys.joinedRooms(userId),
        }),
      ]);
    },
  });
}
