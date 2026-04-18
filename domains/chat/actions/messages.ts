"use server";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

import type { Message } from "@domains/chat/types/chat.types";

export async function sendMessage(data: {
  id: string;
  text: string;
  roomId: string;
}): Promise<
  { error: false; message: Message } | { error: true; message: string }
> {
  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  if (!data.text.trim()) {
    return { error: true, message: "Message cannot be empty" };
  }

  const supabase = createSupabaseAdminClient();

  const { data: membership, error: membershipError } = await supabase
    .from("chat_room_member")
    .select("member_id")
    .eq("chat_room_id", data.roomId)
    .eq("member_id", user.id)
    .single();

  if (membershipError || !membership) {
    return { error: true, message: "User is not a member of the chat room" };
  }

  const { data: message, error } = await supabase
    .from("message")
    .insert({
      id: data.id,
      text: data.text.trim(),
      chat_room_id: data.roomId,
      author_id: user.id,
    })
    .select(
      "id, text, created_at, author_id, author:user_profile (name, image_url)",
    )
    .single();

  if (error) {
    return { error: true, message: "Failed to send message" };
  }

  return { error: false, message };
}
