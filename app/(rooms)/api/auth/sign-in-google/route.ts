import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const raw = body as Record<string, unknown>;
  const redirectTo = raw.redirectTo;

  if (typeof redirectTo !== "string" || !redirectTo.trim()) {
    return jsonError("redirectTo is required", 400);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.trim(),
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return jsonError(error.message || "Google sign-in failed", 400);
  }

  const url = data.url;
  if (typeof url !== "string" || !url) {
    return jsonError("Could not start Google sign-in", 500);
  }

  return NextResponse.json({ error: false, url });
}
