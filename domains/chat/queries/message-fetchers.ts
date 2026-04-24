import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";

import type { CachedMessage, MessageAttachment } from "@domains/chat/types/chat.types";

export const MESSAGES_PAGE_SIZE = 25;
export const MESSAGES_INITIAL_PAGE_SIZE = 10;

export type MessagesPage = CachedMessage[];

export async function fetchMessagesPage(
  supabase: SupabaseClient<Database>,
  roomId: string,
  pageParam: string | null,
  limit: number,
): Promise<MessagesPage> {
  let query = supabase
    .from("message")
    .select(
      "id, text, created_at, author_id, role, error_message, author:user_profile (name, image_url), attachments:message_attachment (id, kind, mime_type, size_bytes, width, height)",
    )
    .eq("chat_room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (pageParam != null) {
    query = query.lt("created_at", pageParam);
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

export function getNextPageParamForMessages(
  lastPage: MessagesPage,
  _allPages: MessagesPage[],
  lastPageParam: string | null | undefined,
): string | undefined {
  const expected =
    lastPageParam == null ? MESSAGES_INITIAL_PAGE_SIZE : MESSAGES_PAGE_SIZE;
  if (lastPage.length < expected) return undefined;
  return lastPage[lastPage.length - 1]?.created_at ?? undefined;
}
