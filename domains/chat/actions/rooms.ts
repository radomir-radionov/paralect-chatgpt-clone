"use server";

import { redirect } from "next/navigation";
import z from "zod";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

import {
  createRoomSchema,
  deleteRoomSchema,
  startRoomWithFirstMessageSchema,
  updateRoomModelSchema,
} from "@domains/chat/schemas/rooms";

const DEFAULT_ROOM_NAME = "AI Chat";

function deriveRoomNameFromText(text: string): string {
  const normalized = text.replaceAll(/\s+/g, " ").trim();
  if (normalized.length === 0) return DEFAULT_ROOM_NAME;

  const maxLen = 60;
  if (normalized.length <= maxLen) return normalized;

  return `${normalized.slice(0, maxLen).trimEnd()}…`;
}

export async function createRoom(unsafeData: z.infer<typeof createRoomSchema>) {
  const { success, data } = createRoomSchema.safeParse(unsafeData);

  if (!success) {
    return { error: true, message: "Invalid room data" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .insert({
      name: data.name,
      is_public: false,
      owner_id: user.id,
      model_slug: data.modelSlug,
    })
    .select("id")
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Failed to create room" };
  }

  redirect(`/rooms/${room.id}`);
}

type StartRoomWithFirstMessageResult =
  | { error: false; roomId: string }
  | { error: true; message: string; roomId?: string };

export async function startRoomWithFirstMessage(
  unsafeData: z.infer<typeof startRoomWithFirstMessageSchema>,
): Promise<StartRoomWithFirstMessageResult> {
  const { success, data } = startRoomWithFirstMessageSchema.safeParse(unsafeData);

  if (!success) {
    return { error: true, message: "Invalid message data" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  const derivedRoomName = deriveRoomNameFromText(data.text);
  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .insert({
      name: derivedRoomName,
      is_public: false,
      owner_id: user.id,
      model_slug: data.modelSlug,
    })
    .select("id")
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Failed to create room" };
  }

  const { data: userMessageRow, error: userMessageError } = await supabase
    .from("message")
    .insert({
      id: data.messageId,
      text: data.text.trim(),
      chat_room_id: room.id,
      author_id: user.id,
      role: "user",
    })
    .select("created_at")
    .single();

  if (userMessageError || userMessageRow == null) {
    // Room is created; allow the client to navigate into it anyway.
    return { error: true, message: "Failed to send message", roomId: room.id };
  }

  await supabase
    .from("chat_room")
    .update({
      name: derivedRoomName,
      last_message_at: userMessageRow.created_at,
    })
    .eq("id", room.id);

  return { error: false, roomId: room.id };
}

export async function deleteRoom(
  unsafeData: z.infer<typeof deleteRoomSchema>,
): Promise<{ error: boolean; message?: string }> {
  const { success, data } = deleteRoomSchema.safeParse(unsafeData);
  if (!success) {
    return { error: true, message: "Invalid room id" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  // Ensure ownership (match sendMessage pattern)
  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id")
    .eq("id", data.roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Chat not found" };
  }

  // Delete messages explicitly (safe even if DB cascades)
  await supabase.from("message").delete().eq("chat_room_id", room.id);

  const { error: deleteError } = await supabase
    .from("chat_room")
    .delete()
    .eq("id", room.id)
    .eq("owner_id", user.id);

  if (deleteError) {
    return { error: true, message: "Failed to delete chat" };
  }

  return { error: false };
}

export async function updateRoomModel(
  unsafeData: z.infer<typeof updateRoomModelSchema>,
): Promise<{ error: boolean; message?: string }> {
  const { success, data } = updateRoomModelSchema.safeParse(unsafeData);
  if (!success) {
    return { error: true, message: "Invalid model update data" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id")
    .eq("id", data.roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Chat not found" };
  }

  const { error: updateError } = await supabase
    .from("chat_room")
    .update({ model_slug: data.modelSlug })
    .eq("id", room.id)
    .eq("owner_id", user.id);

  if (updateError) {
    return { error: true, message: "Failed to update model" };
  }

  return { error: false };
}
