import { ANON_COOKIE_NAME } from "@/server/anon/quota";

const MAX_AGE = 60 * 60 * 24 * 400;

export function withAnonSessionCookie(
  res: Response,
  token: string,
): Response {
  const headers = new Headers(res.headers);
  headers.set(
    "Set-Cookie",
    `${ANON_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`,
  );
  return new Response(res.body, { status: res.status, headers });
}
