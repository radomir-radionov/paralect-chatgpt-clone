import "server-only";

import type { MessagesPage } from "@domains/chat/room/queries/message-pagination";
import { fetchMessagesPage } from "@domains/chat/room/queries/message-fetchers";
import { fetchRoom } from "@domains/chat/room/queries/room-fetchers";
import { ApiError } from "@shared/lib/http/ApiError";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

function buildNextCursor(items: { created_at: string; id: string }[]): string | null {
  const last = items[items.length - 1];
  if (last == null) return null;
  return `${last.created_at}|${last.id}`;
}

/**
 * Loads a messages page without verifying room ownership again.
 * Use only after `getRoom` has succeeded for this `roomId` (e.g. SSR prefetch).
 */
export async function fetchRoomMessagesPageDirect(options: {
  readonly roomId: string;
  readonly cursor: string | null;
  readonly limit: number;
}): Promise<MessagesPage> {
  const supabase = createSupabaseAdminClient();
  return fetchMessagesPage(
    supabase,
    options.roomId,
    options.cursor,
    options.limit,
  );
}

export async function getMessagesPage(options: {
  readonly roomId: string;
  readonly cursor: string | null;
  readonly limit: number;
}) {
  const user = await getCurrentUser();
  if (user == null) {
    throw new ApiError("User not authenticated", 401);
  }

  const supabase = createSupabaseAdminClient();
  const room = await fetchRoom(supabase, options.roomId, user.id);
  if (room == null) {
    throw new ApiError("Chat not found", 404);
  }

  const items = await fetchMessagesPage(
    supabase,
    options.roomId,
    options.cursor,
    options.limit,
  );
  const nextCursor =
    items.length < options.limit ? null : buildNextCursor(items);

  return { items, nextCursor };
}
