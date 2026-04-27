import { NextResponse } from "next/server";

import { fetchMessagesPage } from "@domains/chat/queries/message-fetchers";
import { fetchRoom } from "@domains/chat/queries/room-fetchers";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

function parseLimit(raw: string | null): number {
  if (raw == null) return 25;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 25;
  const asInt = Math.trunc(parsed);
  return Math.min(50, Math.max(1, asInt));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (user == null) {
    return NextResponse.json(
      { error: true, message: "User not authenticated" },
      { status: 401 },
    );
  }

  const { roomId } = await params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = parseLimit(url.searchParams.get("limit"));

  const supabase = createSupabaseAdminClient();

  const room = await fetchRoom(supabase, roomId, user.id);
  if (room == null) {
    return NextResponse.json({ error: true, message: "Chat not found" }, { status: 404 });
  }

  const items = await fetchMessagesPage(supabase, roomId, cursor, limit);
  const nextCursor =
    items.length < limit ? null : (items[items.length - 1]?.created_at ?? null);

  return NextResponse.json({ error: false, items, nextCursor });
}
