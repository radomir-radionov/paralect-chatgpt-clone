import {
  ANON_MAX_FREE,
} from "@/server/anon/quota";
import {
  attachPrincipalHeaders,
  resolveRequestPrincipal,
} from "@/server/auth/principal";

export async function GET(request: Request) {
  try {
    const principal = await resolveRequestPrincipal(request);
    if (principal.role !== "guest") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const remaining = Math.max(0, ANON_MAX_FREE - principal.count);
    const res = Response.json({
      used: principal.count,
      remaining,
      limit: ANON_MAX_FREE,
    });
    const headers = new Headers(res.headers);
    attachPrincipalHeaders(headers, principal);
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
