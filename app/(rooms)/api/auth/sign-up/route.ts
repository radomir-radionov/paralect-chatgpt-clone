import { signUpSchema } from "@domains/auth/schemas/auth";
import { signUpWelcomeRedirectUrl } from "@shared/lib/http/appOrigin";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { readJson } from "@shared/lib/http/readJson";
import { withSupabaseAuthServerClient } from "@shared/lib/supabase/withSupabaseServerClient";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bodyResult = await readJson(req);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.data;

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid request body",
      400,
    );
  }
  const { email, password } = parsed.data;
  const emailRedirectTo = signUpWelcomeRedirectUrl(req);

  return withSupabaseAuthServerClient(async (supabase) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      return jsonError(error.message || "Sign-up failed", 400);
    }

    const identities = data.user?.identities;
    const isNewRegistration = identities != null && identities.length > 0;
    const hasSession = data.session != null;

    return jsonOk({ isNewRegistration, hasSession });
  });
}
