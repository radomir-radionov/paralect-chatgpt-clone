import "server-only";

import type { MessagesPage } from "@domains/chat/queries/message-fetchers";
import { apiUrl } from "@shared/lib/http/apiUrl";
import { fetchApiOk } from "@shared/lib/http/fetchApiOk";
import { getForwardedRequestHeaders } from "@shared/lib/http/getForwardedRequestHeaders";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";

export async function getMessagesPage(options: {
  readonly roomId: string;
  readonly cursor: string | null;
  readonly limit: number;
  readonly origin?: string;
}) {
  const origin = options.origin ?? (await getRequestOrigin());
  const headers = await getForwardedRequestHeaders();

  const search = new URLSearchParams();
  if (options.cursor != null) search.set("cursor", options.cursor);
  search.set("limit", String(options.limit));

  const data = await fetchApiOk<{ items: MessagesPage; nextCursor: string | null }>(
    apiUrl(`/api/rooms/${options.roomId}/messages?${search.toString()}`, origin),
    { method: "GET", cache: "no-store", headers },
  );

  return { items: data.items, nextCursor: data.nextCursor };
}

