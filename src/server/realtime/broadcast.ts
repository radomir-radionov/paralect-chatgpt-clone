import { getServiceSupabase } from "@/server/supabase/service";

export async function broadcastChatEvent(
  userId: string,
  event: "chat_created" | "chat_deleted" | "chat_updated",
  payload: unknown,
) {
  try {
    const supabase = getServiceSupabase();
    const channel = supabase.channel(`user:${userId}`, {
      config: { broadcast: { self: true } },
    });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Realtime subscribe timeout")), 8000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(t);
          resolve();
        }
        if (status === "CHANNEL_ERROR") {
          clearTimeout(t);
          reject(new Error("Realtime channel error"));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
    await supabase.removeChannel(channel);
  } catch (e) {
    console.warn("Realtime broadcast skipped:", e);
  }
}
