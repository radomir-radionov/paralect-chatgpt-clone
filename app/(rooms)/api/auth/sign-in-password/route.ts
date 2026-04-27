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

  if (typeof email !== "string" || !email.trim()) {
    return jsonError("Email is required", 400);
  }
  if (typeof password !== "string" || !password) {
    return jsonError("Password is required", 400);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return jsonError(error.message || "Sign-in failed", 401);
  }

  return NextResponse.json({ error: false });
}
