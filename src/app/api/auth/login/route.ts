import { z } from "zod";
import { emailPasswordSchema } from "@/lib/validation/auth";
import { exchangePasswordForTokens } from "@/server/auth/gotrue";
import { createRouteHandlerSupabase } from "@/server/auth/route-handler-supabase";

export async function POST(request: Request) {
  try {
    const body = emailPasswordSchema.parse(await request.json());
    const tokens = await exchangePasswordForTokens(body.email, body.password);
    const supabase = await createRouteHandlerSupabase();
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ user: tokens.user });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Login failed";
    const status =
      message.toLowerCase().includes("invalid") ||
      message.toLowerCase().includes("credentials")
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}
