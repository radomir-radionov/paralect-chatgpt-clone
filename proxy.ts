import {
  createSupabaseMiddlewareClient,
  type MiddlewareResponseState,
} from "@/lib/supabase/middleware-client";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = new Set(["/login", "/email-password", "/google-login"]);

function isProtectedPath(pathname: string) {
  return pathname === "/" || pathname === "/profile";
}

/**
 * Copies cookies from one Next.js response to another (used when redirecting
 * after `getUser()` may have refreshed the session).
 */
function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  sourceResponse: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value);
  });
  return redirect;
}

/** Same path as the request but strips OAuth query params from the address bar. */
function redirectCleanUrlWithCookies(
  request: NextRequest,
  sourceResponse: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  const redirect = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value);
  });
  return redirect;
}

/**
 * Next.js proxy (middleware): Supabase session refresh + route gating.
 * Guests hitting `/` or `/profile` are sent to `/login`. Guests can still reach
 * other routes (e.g. `/welcome`). Signed-in users hitting auth routes go to `/`.
 */
export async function proxy(request: NextRequest) {
  const state: MiddlewareResponseState = {
    response: NextResponse.next({
      request: { headers: request.headers },
    }),
  };

  const supabase = createSupabaseMiddlewareClient(request, state);

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const { response } = state;

  if (user) {
    if (AUTH_ROUTES.has(pathname)) {
      return redirectWithCookies(request, "/", response);
    }
    if (code) {
      return redirectCleanUrlWithCookies(request, response);
    }
  } else if (isProtectedPath(pathname)) {
    return redirectWithCookies(request, "/login", response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
