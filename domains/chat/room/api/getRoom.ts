import "server-only";

import type { RoomDetails } from "@domains/chat/room/queries/room-fetchers";
import { apiUrl } from "@shared/lib/http/apiUrl";
import { getForwardedRequestHeaders } from "@shared/lib/http/getForwardedRequestHeaders";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";

/**
 * Fetches the room server-side. Returns `null` when the room does not exist
 * (404) or when access is denied — mirrors `clientGetRoom`.
 */
export async function getRoom(
  roomId: string,
  options?: { readonly origin?: string },
): Promise<RoomDetails | null> {
  const origin = options?.origin ?? (await getRequestOrigin());
  const headers = await getForwardedRequestHeaders();

  const res = await fetch(apiUrl(`/api/rooms/${roomId}`, origin), {
    method: "GET",
    cache: "no-store",
    headers,
  });

  if (res.status === 404 || !res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const data = json as { error?: boolean; room?: RoomDetails };
  if (data.error !== false || data.room == null) return null;
  return data.room;
}
