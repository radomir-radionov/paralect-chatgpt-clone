import "server-only";

import type { RoomDetails } from "@domains/chat/queries/room-fetchers";
import { apiUrl } from "@shared/lib/http/apiUrl";
import { fetchApiOk } from "@shared/lib/http/fetchApiOk";
import { getForwardedRequestHeaders } from "@shared/lib/http/getForwardedRequestHeaders";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";

export async function getRoom(
  roomId: string,
  options?: { readonly origin?: string },
) {
  const origin = options?.origin ?? (await getRequestOrigin());
  const headers = await getForwardedRequestHeaders();

  const data = await fetchApiOk<{ room: RoomDetails }>(
    apiUrl(`/api/rooms/${roomId}`, origin),
    { method: "GET", cache: "no-store", headers },
  );
  return data.room;
}

