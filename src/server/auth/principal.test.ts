import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import {
  assertUserPrincipal,
  attachPrincipalHeaders,
  resolveRequestPrincipal,
} from "@/server/auth/principal";

function createUser(id: string): User {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2024-01-01T00:00:00.000Z",
  } as User;
}

test("resolveRequestPrincipal prefers authenticated users over guest sessions", async () => {
  const request = new Request("http://localhost/api/test");
  let guestResolverCalls = 0;

  const principal = await resolveRequestPrincipal(request, {
    getUser: async () => createUser("user-1"),
    getGuestSession: async () => {
      guestResolverCalls += 1;
      return {
        sessionId: "guest-1",
        token: "guest-token",
        count: 2,
      };
    },
  });

  assert.equal(principal.role, "user");
  assert.equal(principal.user.id, "user-1");
  assert.equal(guestResolverCalls, 0);
});

test("resolveRequestPrincipal falls back to guest sessions and exposes cookie headers", async () => {
  const request = new Request("http://localhost/api/test", {
    headers: {
      cookie: "anon_session=existing",
    },
  });

  const principal = await resolveRequestPrincipal(request, {
    getUser: async () => null,
    getGuestSession: async (cookieHeader) => {
      assert.equal(cookieHeader, "anon_session=existing");
      return {
        sessionId: "guest-1",
        token: "guest-token",
        count: 2,
      };
    },
  });

  assert.equal(principal.role, "guest");
  assert.equal(principal.sessionId, "guest-1");
  assert.equal(principal.count, 2);

  const headers = new Headers();
  attachPrincipalHeaders(headers, principal);

  assert.equal(
    headers.get("Set-Cookie"),
    "anon_session=guest-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=34560000",
  );
});

test("attachPrincipalHeaders skips cookies for authenticated principals", () => {
  const headers = new Headers();

  attachPrincipalHeaders(headers, {
    role: "user",
    user: createUser("user-1"),
  });

  assert.equal(headers.has("Set-Cookie"), false);
});

test("assertUserPrincipal returns the user principal and rejects guests", () => {
  const userPrincipal = {
    role: "user" as const,
    user: createUser("user-1"),
  };

  assert.equal(assertUserPrincipal(userPrincipal).user.id, "user-1");

  assert.throws(
    () =>
      assertUserPrincipal({
        role: "guest",
        sessionId: "guest-1",
        token: "guest-token",
        count: 0,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "status" in error &&
      (error as Error & { status?: number }).status === 401,
  );
});
