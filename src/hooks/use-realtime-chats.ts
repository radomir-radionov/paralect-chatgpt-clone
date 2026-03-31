"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { invalidateChatsListDebounced } from "@/lib/invalidate-chats-list";
import { getRealtimeSupabase } from "@/lib/supabase/realtime";

export function useRealtimeChats(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const supabase = getRealtimeSupabase();
    const channel = supabase.channel(`user:${userId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "chat_created" }, () => {
        invalidateChatsListDebounced(queryClient);
      })
      .on("broadcast", { event: "chat_deleted" }, () => {
        invalidateChatsListDebounced(queryClient);
      })
      .on("broadcast", { event: "chat_updated" }, () => {
        invalidateChatsListDebounced(queryClient);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
