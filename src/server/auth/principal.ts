import type { User } from "@supabase/supabase-js";
import {
  ANON_COOKIE_NAME,
  getOrCreateAnonymousSession,
} from "@/server/anon/quota";
import { getUserFromRequest } from "@/server/auth/session";

const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export type GuestRequestPrincipal = {
  role: "guest";
  sessionId: string;
  token: string;
  count: number;
};

export type UserRequestPrincipal = {
  role: "user";
  user: User;
};

export type RequestPrincipal = GuestRequestPrincipal | UserRequestPrincipal;

type ResolveRequestPrincipalDependencies = {
  getUser?: (request: Request) => Promise<User | null>;
  getGuestSession?: (
    cookieHeader: string | null,
  ) => Promise<{ sessionId: string; token: string; count: number }>;
};

export async function resolveRequestPrincipal(
  request: Request,
  dependencies: ResolveRequestPrincipalDependencies = {},
): Promise<RequestPrincipal> {
  const getUser = dependencies.getUser ?? getUserFromRequest;
  const getGuestSession =
    dependencies.getGuestSession ?? getOrCreateAnonymousSession;

  const user = await getUser(request);
  if (user) {
    return {
      role: "user",
      user,
    };
  }

  const guestSession = await getGuestSession(request.headers.get("cookie"));
  return {
    role: "guest",
    sessionId: guestSession.sessionId,
    token: guestSession.token,
    count: guestSession.count,
  };
}

export function attachPrincipalHeaders(
  headers: Headers,
  principal: RequestPrincipal,
): void {
  if (principal.role !== "guest") return;
  headers.set(
    "Set-Cookie",
    `${ANON_COOKIE_NAME}=${principal.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ANON_COOKIE_MAX_AGE_SECONDS}`,
  );
}

export function assertUserPrincipal(
  principal: RequestPrincipal,
): UserRequestPrincipal {
  if (principal.role === "user") {
    return principal;
  }

  const error = new Error("Unauthorized") as Error & { status: number };
  error.status = 401;
  throw error;
}
