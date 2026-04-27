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
  const email = raw.email;
  const password = raw.password;
  const emailRedirectTo = raw.emailRedirectTo;

  if (typeof email !== "string" || !email.trim()) {
    return jsonError("Email is required", 400);
  }
  if (typeof password !== "string" || password.length < 6) {
    return jsonError("Password must be at least 6 characters", 400);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options:
      typeof emailRedirectTo === "string" && emailRedirectTo.trim()
        ? { emailRedirectTo: emailRedirectTo.trim() }
        : undefined,
  });

  if (error) {
    return jsonError(error.message || "Sign-up failed", 400);
  }

  const identities = data.user?.identities;
  const isNewRegistration = identities != null && identities.length > 0;
  const hasSession = data.session != null;

  return NextResponse.json({
    error: false,
    isNewRegistration,
    hasSession,
  });
}
