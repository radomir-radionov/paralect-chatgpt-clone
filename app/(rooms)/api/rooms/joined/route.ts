import { NextResponse } from "next/server";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";
import { fetchJoinedRooms } from "@domains/chat/queries/room-fetchers";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (user == null) {
    return NextResponse.json(
      { error: true, message: "User not authenticated" },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();

  try {
    const rooms = await fetchJoinedRooms(supabase, user.id);
    return NextResponse.json({ error: false, rooms });
  } catch (error) {
    console.error("[api/rooms/joined]", error);
    return NextResponse.json(
      { error: true, message: "Internal server error" },
      { status: 500 },
    );
  }
}
