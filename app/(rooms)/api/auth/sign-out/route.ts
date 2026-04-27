import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      { error: true, message: error.message || "Sign-out failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: false });
}
