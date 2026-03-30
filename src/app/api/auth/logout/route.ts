import { createRouteHandlerSupabase } from "@/server/auth/route-handler-supabase";

export async function POST() {
  try {
    const supabase = await createRouteHandlerSupabase();
    await supabase.auth.signOut();
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign out failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
