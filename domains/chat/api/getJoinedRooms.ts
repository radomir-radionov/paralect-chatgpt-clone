import type { RoomListItem } from "@domains/chat/queries/room-fetchers";
import { apiUrl } from "@shared/lib/http/apiUrl";
import { fetchApiOk } from "@shared/lib/http/fetchApiOk";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";
import { cookies } from "next/headers";

async function getRequestCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function getJoinedRooms(options?: { readonly origin?: string }) {
  const origin = options?.origin ?? (await getRequestOrigin());
  const cookie = await getRequestCookieHeader();

  const data = await fetchApiOk<{ rooms: RoomListItem[] }>(
    apiUrl("/api/rooms/joined", origin),
    { method: "GET", cache: "no-store", headers: cookie ? { cookie } : undefined },
  );
  return data.rooms;
}

