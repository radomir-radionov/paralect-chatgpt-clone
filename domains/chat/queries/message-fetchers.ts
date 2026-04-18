import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";

import type { CachedMessage } from "@domains/chat/types/chat.types";

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
      "id, text, created_at, author_id, author:user_profile (name, image_url)",
    )
    .eq("chat_room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (pageParam != null) {
    query = query.lt("created_at", pageParam);
  }

  const { data, error } = await query;
  if (error) return [];
  return data;
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
