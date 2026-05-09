import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";

import type { MessageAttachment } from "@domains/chat/types/chat.types";

import type { MessagesPage } from "@domains/chat/room/queries/message-pagination";

export async function fetchMessagesPage(
  supabase: SupabaseClient<Database>,
  roomId: string,
  pageParam: string | null,
  limit: number,
): Promise<MessagesPage> {
  const cursor = parseMessagesCursor(pageParam);
  let query = supabase
    .from("message")
    .select(
      "id, text, created_at, author_id, role, error_message, author:user_profile (name, image_url), attachments:message_attachment (id, kind, mime_type, size_bytes, width, height, original_name, extracted_chars)",
    )
    .eq("chat_room_id", roomId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor?.kind === "legacy_timestamp") {
    query = query.lt("created_at", cursor.createdAt);
  } else if (cursor?.kind === "composite") {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) return [];
  return data.map((message) => ({
    id: message.id,
    text: message.text,
    created_at: message.created_at,
    author_id: message.author_id,
    role: message.role,
    error_message: message.error_message,
    attachments:
      (message as unknown as { attachments?: MessageAttachment[] }).attachments ??
      undefined,
    author:
      message.role === "assistant"
        ? { name: "Assistant", image_url: null }
        : {
            name: message.author?.name ?? "You",
            image_url: message.author?.image_url ?? null,
          },
  }));
}

type MessagesCursor =
  | { readonly kind: "legacy_timestamp"; readonly createdAt: string }
  | { readonly kind: "composite"; readonly createdAt: string; readonly id: string };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseMessagesCursor(raw: string | null): MessagesCursor | null {
  if (raw == null || raw.trim() === "") return null;

  const trimmed = raw.trim();
  const pipeIdx = trimmed.indexOf("|");
  if (pipeIdx === -1) {
    return { kind: "legacy_timestamp", createdAt: trimmed };
  }

  const createdAt = trimmed.slice(0, pipeIdx).trim();
  const id = trimmed.slice(pipeIdx + 1).trim();
  if (!createdAt || !isUuid(id)) {
    return { kind: "legacy_timestamp", createdAt: trimmed };
  }
  return { kind: "composite", createdAt, id };
}
