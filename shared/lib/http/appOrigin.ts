/**
 * Public site origin for server-side redirects (e.g. Supabase email links).
 * Prefer NEXT_PUBLIC_SITE_URL when the request Host does not match the public URL.
 */
export function resolvePublicOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return vercel.startsWith("http://") || vercel.startsWith("https://")
      ? vercel
      : `https://${vercel}`;
  }

  return new URL(request.url).origin;
}

export function signUpWelcomeRedirectUrl(request: Request): string {
  return new URL("/welcome", resolvePublicOrigin(request)).toString();
}

/** Supabase OAuth `redirectTo` after provider callback (app root). */
export function googleOAuthReturnUrl(request: Request): string {
  return new URL("/", resolvePublicOrigin(request)).toString();
}
