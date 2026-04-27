import { NextResponse } from "next/server";

import { fetchProfile } from "@domains/auth/queries/profile-fetcher";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

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
  const profile = await fetchProfile(supabase, user.id);

  if (profile == null) {
    return NextResponse.json({ error: true, message: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ error: false, profile });
}
