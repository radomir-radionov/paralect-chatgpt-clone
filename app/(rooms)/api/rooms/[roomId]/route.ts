import { NextResponse } from "next/server";

import { fetchRoom } from "@domains/chat/queries/room-fetchers";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
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
  const supabase = createSupabaseAdminClient();
  const room = await fetchRoom(supabase, roomId, user.id);

  if (room == null) {
    return NextResponse.json({ error: true, message: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ error: false, room });
}
