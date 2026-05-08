import { signUpSchema } from "@domains/auth/schemas/auth";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { readJson } from "@shared/lib/http/readJson";
import { withSupabaseServerClient } from "@shared/lib/supabase/withSupabaseServerClient";

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
  const { email, password, emailRedirectTo } = parsed.data;

  return withSupabaseServerClient(async (supabase) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
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
