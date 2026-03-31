import { z } from "zod";
import { emailPasswordSchema } from "@/lib/validation/auth";
import {
  isDuplicateEmailSignUpResponse,
  signUpWithGoTrue,
} from "@/server/auth/gotrue";
import { createRouteHandlerSupabase } from "@/server/auth/route-handler-supabase";

export async function POST(request: Request) {
  try {
    const body = emailPasswordSchema.parse(await request.json());
    const data = await signUpWithGoTrue(body.email, body.password);

    if (isDuplicateEmailSignUpResponse(data.user)) {
      return Response.json(
        {
          error:
            "An account with this email already exists. Sign in instead.",
        },
        { status: 409 },
      );
    }

    if (data.access_token && data.refresh_token) {
      const supabase = await createRouteHandlerSupabase();
      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ user: data.user });
    }

    return Response.json(
      { error: "Sign up failed to establish a session." },
      { status: 400 },
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Sign up failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
