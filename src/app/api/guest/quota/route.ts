import {
  ANON_COOKIE_NAME,
  ANON_MAX_FREE,
  getOrCreateAnonymousSession,
} from "@/server/anon/quota";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);
    const remaining = Math.max(0, ANON_MAX_FREE - session.count);
    const res = Response.json({
      used: session.count,
      remaining,
      limit: ANON_MAX_FREE,
    });
    const headers = new Headers(res.headers);
    headers.set(
      "Set-Cookie",
      `${ANON_COOKIE_NAME}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}`,
    );
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
