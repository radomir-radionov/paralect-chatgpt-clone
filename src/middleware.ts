import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function allowedApiOrigins(): string[] {
  const raw = process.env.ALLOWED_API_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  const isApi = pathname.startsWith("/api/");
  const allowed = allowedApiOrigins();

  if (request.method === "OPTIONS" && isApi) {
    const origin = request.headers.get("origin");
    if (origin && allowed.includes(origin)) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, Cookie, X-Requested-With",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
  }

  // Logout clears cookies in the route handler only — skip getUser() here so we
  // don't refresh the session immediately before signOut (client cache + nav stay in useSignOutMutation).
  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const response = NextResponse.next({ request });
    if (isApi && allowed.length > 0) {
      const origin = request.headers.get("origin");
      if (origin && allowed.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Credentials", "true");
      }
    }
    return response;
  }

  const response = NextResponse.next({ request });
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  await supabase.auth.getUser();

  if (isApi && allowed.length > 0) {
    const origin = request.headers.get("origin");
    if (origin && allowed.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
