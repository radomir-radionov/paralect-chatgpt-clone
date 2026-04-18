"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { replaceMessage } from "@domains/chat/queries/messagesCache";
import type { Message } from "@domains/chat/types/chat.types";

export function useRealtimeChat({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [connectedUsers, setConnectedUsers] = useState(1);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let newChannel: RealtimeChannel;
    let cancel = false;

    supabase.realtime.setAuth().then(() => {
      if (cancel) return;

      newChannel = supabase.channel(`room:${roomId}:messages`, {
        config: {
          private: true,
          presence: {
            key: userId,
          },
        },
      });

      channelRef.current = newChannel;

      newChannel
        .on("presence", { event: "sync" }, () => {
          setConnectedUsers(Object.keys(newChannel.presenceState()).length);
        })
        .on("broadcast", { event: "INSERT" }, (payload) => {
          const record = payload.payload;
          replaceMessage(queryClient, roomId, {
            id: record.id,
            text: record.text,
            created_at: record.created_at,
            author_id: record.author_id,
            author: {
              name: record.author_name,
              image_url: record.author_image_url,
            },
            status: "success",
          });
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          newChannel.track({ userId });
        });
    });

    return () => {
      cancel = true;
      channelRef.current = null;
      if (!newChannel) return;
      newChannel.untrack();
      newChannel.unsubscribe();
    };
  }, [queryClient, roomId, userId]);

  async function broadcastMessage(message: Message) {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "INSERT",
      payload: {
        id: message.id,
        text: message.text,
        created_at: message.created_at,
        author_id: message.author_id,
        author_name: message.author.name,
        author_image_url: message.author.image_url,
      },
    });
  }

  return { connectedUsers, broadcastMessage };
}
