import { NextResponse } from "next/server";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (user == null) {
    return NextResponse.json(
      { error: true, message: "User not authenticated" },
      { status: 401 },
    );
  }

  return NextResponse.json({ error: false, user });
}
