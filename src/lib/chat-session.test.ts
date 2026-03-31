import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import {
  getChatApiSurface,
  resolveChatSessionState,
} from "@/lib/chat-session";

function createUser(id: string): User {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2024-01-01T00:00:00.000Z",
  } as User;
}

test("resolveChatSessionState returns loading before auth resolves", () => {
  const session = resolveChatSessionState({
    user: null,
    authLoading: true,
  });

  assert.equal(session.status, "loading");
  assert.equal(session.role, null);
});

test("resolveChatSessionState returns guest for resolved anonymous users", () => {
  const session = resolveChatSessionState({
    user: null,
    authLoading: false,
  });

  assert.equal(session.status, "guest");
  assert.equal(session.role, "guest");
});

test("resolveChatSessionState returns user for authenticated users", () => {
  const session = resolveChatSessionState({
    user: createUser("user-1"),
    authLoading: false,
  });

  assert.equal(session.status, "user");
  assert.equal(session.role, "user");
  assert.equal(session.user.id, "user-1");
});

test("getChatApiSurface returns the guest route set", () => {
  const surface = getChatApiSurface(
    resolveChatSessionState({
      user: null,
      authLoading: false,
    }),
  );

  assert.deepEqual(surface.documentQueryKey, ["guest-documents"]);
  assert.equal(surface.documentsPath, "/api/guest/documents");
  assert.equal(surface.deleteDocumentPath("doc-1"), "/api/guest/documents/doc-1");
  assert.equal(surface.quotaPath, "/api/guest/quota");
});

test("getChatApiSurface returns the authenticated route set", () => {
  const surface = getChatApiSurface(
    resolveChatSessionState({
      user: createUser("user-1"),
      authLoading: false,
    }),
  );

  assert.deepEqual(surface.documentQueryKey, ["documents"]);
  assert.equal(surface.documentsPath, "/api/documents");
  assert.equal(surface.deleteDocumentPath("doc-1"), "/api/documents/doc-1");
  assert.equal(surface.quotaPath, null);
});
