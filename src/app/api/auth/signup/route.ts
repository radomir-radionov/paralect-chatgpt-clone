import { z } from "zod";
import { emailPasswordSchema } from "@/lib/validation/auth";
import {
  isDuplicateEmailSignUpResponse,
  signUpWithGoTrue,
} from "@/server/auth/gotrue";
import { createRouteHandlerSupabase } from "@/server/auth/route-handler-supabase";

function isAuthEmailRateLimitMessage(message: string): boolean {
  return message.toLowerCase().includes("email rate limit");
}

export async function POST(request: Request) {
  try {
    const body = emailPasswordSchema.parse(await request.json());
    const data = await signUpWithGoTrue(body.email, body.password);

    if (data.access_token && data.refresh_token) {
      const supabase = await createRouteHandlerSupabase();
      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ user: data.user, needsEmailConfirmation: false });
    }

    if (isDuplicateEmailSignUpResponse(data.user)) {
      return Response.json(
        {
          error:
            "An account with this email already exists. Sign in instead.",
        },
        { status: 409 },
      );
    }

    return Response.json({
      user: data.user,
      needsEmailConfirmation: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Sign up failed";
    if (isAuthEmailRateLimitMessage(message)) {
      return Response.json(
        {
          error:
            "Too many confirmation emails were sent. Try again in a little while, or ask your project admin to review Supabase Auth rate limits and SMTP settings.",
        },
        { status: 429 },
      );
    }
    return Response.json({ error: message }, { status: 400 });
  }
}
