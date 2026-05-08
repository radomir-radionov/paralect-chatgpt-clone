import { signInWithGoogleSchema } from "@domains/auth/schemas/auth";
import { googleOAuthReturnUrl } from "@shared/lib/http/appOrigin";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { readJson } from "@shared/lib/http/readJson";
import { withSupabaseAuthServerClient } from "@shared/lib/supabase/withSupabaseServerClient";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;

  const validated = signInWithGoogleSchema.safeParse(parsed.data);
  if (!validated.success) {
    return jsonError(
      validated.error.issues[0]?.message ?? "Invalid request body",
      400,
    );
  }
  const redirectTo = googleOAuthReturnUrl(req);

  return withSupabaseAuthServerClient(async (supabase) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return jsonError(error.message || "Google sign-in failed", 400);
    }

    const url = data.url;
    if (typeof url !== "string" || !url) {
      return jsonError("Could not start Google sign-in", 500);
    }

    return jsonOk({ url });
  });
}
