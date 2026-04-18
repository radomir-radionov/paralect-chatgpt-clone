"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { chatKeys } from "@domains/chat/queries/keys";

type LeaveRoomInput = {
  roomId: string;
  userId?: string;
};

export function useLeaveRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId }: LeaveRoomInput) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("chat_room_member")
        .delete()
        .eq("chat_room_id", roomId);

      if (error) {
        throw new Error("Failed to leave room");
      }
    },
    onSuccess: async (_data, { userId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.publicRooms }),
        userId
          ? queryClient.invalidateQueries({
              queryKey: chatKeys.joinedRooms(userId),
            })
          : Promise.resolve(),
      ]);
    },
  });
}
