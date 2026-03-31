import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import {
  ingestDocumentForPrincipal,
  retrieveContextForPrincipal,
} from "@/server/rag/principal";
import type { RequestPrincipal } from "@/server/auth/principal";

function createUserPrincipal(id: string): RequestPrincipal {
  return {
    role: "user",
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00.000Z",
    } as User,
  };
}

test("retrieveContextForPrincipal uses the signed-in user scope", async () => {
  const calls: unknown[] = [];

  const result = await retrieveContextForPrincipal(
    createUserPrincipal("user-1"),
    {
      query: "hello",
      documentIds: ["doc-1"],
    },
    {
      retrieveUserContext: async (options) => {
        calls.push(options);
        return "user-context";
      },
      retrieveGuestContext: async () => {
        throw new Error("guest retriever should not run");
      },
    },
  );

  assert.equal(result, "user-context");
  assert.deepEqual(calls, [
    {
      userId: "user-1",
      query: "hello",
      documentIds: ["doc-1"],
    },
  ]);
});

test("retrieveContextForPrincipal uses the guest scope", async () => {
  const calls: unknown[] = [];

  const result = await retrieveContextForPrincipal(
    {
      role: "guest",
      sessionId: "guest-1",
      token: "token",
      count: 2,
    },
    {
      query: "hello",
      documentIds: ["doc-1"],
    },
    {
      retrieveUserContext: async () => {
        throw new Error("user retriever should not run");
      },
      retrieveGuestContext: async (options) => {
        calls.push(options);
        return "guest-context";
      },
    },
  );

  assert.equal(result, "guest-context");
  assert.deepEqual(calls, [
    {
      sessionId: "guest-1",
      query: "hello",
      documentIds: ["doc-1"],
    },
  ]);
});

test("ingestDocumentForPrincipal delegates to the matching document ingester", async () => {
  const userCalls: unknown[] = [];
  const guestCalls: unknown[] = [];

  await ingestDocumentForPrincipal(
    createUserPrincipal("user-1"),
    {
      documentId: "doc-1",
      buffer: Buffer.from("hi"),
      mimeType: "text/plain",
    },
    {
      ingestUserDocument: async (options) => {
        userCalls.push(options);
      },
      ingestGuestDocument: async (options) => {
        guestCalls.push(options);
      },
    },
  );

  await ingestDocumentForPrincipal(
    {
      role: "guest",
      sessionId: "guest-1",
      token: "token",
      count: 0,
    },
    {
      documentId: "doc-2",
      buffer: Buffer.from("hi"),
      mimeType: "text/plain",
    },
    {
      ingestUserDocument: async (options) => {
        userCalls.push(options);
      },
      ingestGuestDocument: async (options) => {
        guestCalls.push(options);
      },
    },
  );

  assert.equal(userCalls.length, 1);
  assert.equal(guestCalls.length, 1);
});
