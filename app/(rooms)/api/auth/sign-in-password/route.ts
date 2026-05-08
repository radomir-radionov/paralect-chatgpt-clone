import { signInWithPasswordSchema } from "@domains/auth/schemas/auth";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { readJson } from "@shared/lib/http/readJson";
import { withSupabaseAuthServerClient } from "@shared/lib/supabase/withSupabaseServerClient";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;

  const validated = signInWithPasswordSchema.safeParse(parsed.data);
  if (!validated.success) {
    return jsonError(
      validated.error.issues[0]?.message ?? "Invalid request body",
      400,
    );
  }
  const { email, password } = validated.data;

  return withSupabaseAuthServerClient(async (supabase) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return jsonError(error.message || "Sign-in failed", 401);
    }

    return jsonOk();
  });
}
