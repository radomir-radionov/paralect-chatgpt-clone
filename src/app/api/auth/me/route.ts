import { createRouteHandlerSupabase } from "@/server/auth/route-handler-supabase";

export async function GET() {
  try {
    const supabase = await createRouteHandlerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      return Response.json({ user: null }, { status: 200 });
    }
    return Response.json({ user: user ?? null });
  } catch {
    return Response.json({ user: null }, { status: 200 });
  }
}
