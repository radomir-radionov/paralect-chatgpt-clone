"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
      })
      .on("broadcast", { event: "chat_deleted" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
      })
      .on("broadcast", { event: "chat_updated" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
