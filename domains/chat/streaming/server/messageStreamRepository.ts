import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";

import type {
  ParsedStreamIncomingDocument,
  PersistedAttachmentRow,
  PersistedHistoryRow,
  StreamIncomingAttachment,
} from "@domains/chat/streaming/lib/streamTypes";

export const MAX_ROOM_HISTORY_MESSAGES = 40;

export async function selectOwnedChatRoomForStream(
  supabase: SupabaseClient<Database>,
  options: { readonly roomId: string; readonly ownerId: string },
): Promise<{ id: string; model_slug: string } | null> {
  const { data, error } = await supabase
    .from("chat_room")
    .select("id, model_slug")
    .eq("id", options.roomId)
    .eq("owner_id", options.ownerId)
    .single();

  if (error || data == null) return null;
  return data;
}

export async function insertStreamUserMessage(
  supabase: SupabaseClient<Database>,
  options: {
    readonly messageId: string;
    readonly text: string;
    readonly chatRoomId: string;
    readonly authorId: string;
  },
): Promise<{ created_at: string } | null> {
  const { data, error } = await supabase
    .from("message")
    .insert({
      id: options.messageId,
      text: options.text,
      chat_room_id: options.chatRoomId,
      author_id: options.authorId,
      role: "user",
    })
    .select("created_at")
    .single();

  if (error || data == null) return null;
  return data;
}

export async function updateChatRoomLastMessageAt(
  supabase: SupabaseClient<Database>,
  options: { readonly chatRoomId: string; readonly lastMessageAt: string },
): Promise<void> {
  await supabase
    .from("chat_room")
    .update({ last_message_at: options.lastMessageAt })
    .eq("id", options.chatRoomId);
}

export async function insertStreamMessageAttachments(
  supabase: SupabaseClient<Database>,
  options: {
    readonly rows: Array<{
      id: string;
      message_id: string;
      chat_room_id: string;
      owner_id: string;
      kind: "image" | "document";
      storage_bucket: string;
      storage_path: string;
      mime_type: string;
      size_bytes: number;
      width: number | null;
      height: number | null;
      original_name: string | null;
      extracted_text: string | null;
      extracted_chars: number | null;
    }>;
  },
): Promise<boolean> {
  if (options.rows.length === 0) return true;
  const { error } = await supabase.from("message_attachment").insert(options.rows);
  return error == null;
}

export function buildStreamAttachmentInsertRows(options: {
  readonly attachments: StreamIncomingAttachment[];
  readonly parsedDocuments: Map<string, ParsedStreamIncomingDocument>;
  readonly userMessageId: string;
  readonly chatRoomId: string;
  readonly ownerId: string;
}) {
  return options.attachments.map((a) => ({
    id: a.id,
    message_id: options.userMessageId,
    chat_room_id: options.chatRoomId,
    owner_id: options.ownerId,
    kind: (a.kind ?? "image") as "image" | "document",
    storage_bucket: "chat-attachments",
    storage_path: a.storagePath,
    mime_type: a.mimeType,
    size_bytes: a.sizeBytes,
    width: typeof a.width === "number" ? a.width : null,
    height: typeof a.height === "number" ? a.height : null,
    original_name:
      typeof a.originalName === "string" && a.originalName.trim()
        ? a.originalName.trim()
        : null,
    extracted_text: options.parsedDocuments.get(a.id)?.extractedText ?? null,
    extracted_chars: options.parsedDocuments.get(a.id)?.extractedChars ?? null,
  }));
}

export async function selectStreamUserMessageForRegenerate(
  supabase: SupabaseClient<Database>,
  options: {
    readonly messageId: string;
    readonly chatRoomId: string;
    readonly authorId: string;
  },
): Promise<{ id: string; role: string; text: string } | null> {
  const { data, error } = await supabase
    .from("message")
    .select("id, role, text")
    .eq("id", options.messageId)
    .eq("chat_room_id", options.chatRoomId)
    .eq("author_id", options.authorId)
    .single();

  if (error || data == null || data.role !== "user") return null;
  return data;
}

export async function fetchStreamMessageHistoryDesc(
  supabase: SupabaseClient<Database>,
  chatRoomId: string,
): Promise<PersistedHistoryRow[] | null> {
  const { data, error } = await supabase
    .from("message")
    .select("id, role, text")
    .eq("chat_room_id", chatRoomId)
    .order("created_at", { ascending: false })
    .limit(MAX_ROOM_HISTORY_MESSAGES);

  if (error || data == null) return null;
  return data.slice().reverse() as PersistedHistoryRow[];
}

export async function fetchStreamMessageAttachments(
  supabase: SupabaseClient<Database>,
  messageIds: string[],
): Promise<PersistedAttachmentRow[] | null> {
  if (messageIds.length === 0) return [];

  const { data, error } = await supabase
    .from("message_attachment")
    .select(
      "id, message_id, kind, storage_bucket, storage_path, mime_type, original_name, extracted_text, extracted_chars",
    )
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) return null;
  return (data ?? []) as PersistedAttachmentRow[];
}

export async function insertStreamAssistantMessage(
  supabase: SupabaseClient<Database>,
  options: {
    readonly messageId: string;
    readonly text: string;
    readonly chatRoomId: string;
  },
): Promise<{ created_at: string } | null> {
  const { data, error } = await supabase
    .from("message")
    .insert({
      id: options.messageId,
      text: options.text,
      chat_room_id: options.chatRoomId,
      role: "assistant",
    })
    .select("created_at")
    .single();

  if (error || data == null) return null;
  return data;
}

export async function upsertStreamAssistantErrorMessage(
  supabase: SupabaseClient<Database>,
  options: {
    readonly messageId: string;
    readonly text: string;
    readonly chatRoomId: string;
  },
): Promise<void> {
  const { data } = await supabase
    .from("message")
    .upsert(
      {
        id: options.messageId,
        text: options.text,
        chat_room_id: options.chatRoomId,
        role: "assistant",
      },
      { onConflict: "id" },
    )
    .select("created_at")
    .single();

  if (data?.created_at) {
    await supabase
      .from("chat_room")
      .update({ last_message_at: data.created_at })
      .eq("id", options.chatRoomId);
  }
}
