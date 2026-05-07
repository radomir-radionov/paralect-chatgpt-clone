import "server-only";

import type { User } from "@supabase/supabase-js";
import z from "zod";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";
import {
  createRoomSchema,
  deleteRoomSchema,
  updateRoomModelSchema,
} from "@domains/chat/schemas/rooms";

/** `chat_room.owner_id` FK targets `user_profile`; rows are normally created by the auth trigger. */
async function ensureUserProfileExists(
  user: User,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existing } = await supabase
    .from("user_profile")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing != null) return { ok: true };

  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    user.email?.trim() ||
    "User";

  const rawImage =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    "";

  const { error } = await supabase.from("user_profile").insert({
    id: user.id,
    name,
    image_url: rawImage.length > 0 ? rawImage : "",
  });

  if (error?.code === "23505") return { ok: true };

  if (error != null) {
    if (process.env.NODE_ENV === "development") {
      console.error("[ensureUserProfileExists]", error.code, error.message);
    }
    return { ok: false, message: "Failed to sync account profile" };
  }

  return { ok: true };
}

export type CreateRoomResult =
  | { error: true; message: string }
  | { error: false; roomId: string };

export async function createRoomMutation(
  unsafeData: z.infer<typeof createRoomSchema>,
): Promise<CreateRoomResult> {
  const { success, data } = createRoomSchema.safeParse(unsafeData);

  if (!success) {
    return { error: true, message: "Invalid room data" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  const profileReady = await ensureUserProfileExists(user, supabase);
  if (!profileReady.ok) {
    return { error: true, message: profileReady.message };
  }

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
    if (process.env.NODE_ENV === "development") {
      console.error("[createRoom chat_room insert]", roomError?.code, roomError?.message);
    }
    return { error: true, message: "Failed to create room" };
  }

  return { error: false, roomId: room.id };
}

export async function deleteRoomMutation(
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

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id")
    .eq("id", data.roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Chat not found" };
  }

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

export async function updateRoomModelMutation(
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
