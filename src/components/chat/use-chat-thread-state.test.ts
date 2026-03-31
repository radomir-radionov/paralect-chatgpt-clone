import assert from "node:assert/strict";
import test from "node:test";
import { createInitialThreadState, reducer } from "@/components/chat/thread-state";
import { createThreadPersistenceSession } from "@/components/chat/thread-persistence";
import {
  persistMovedThread,
  shouldOpenPersistedThread,
  shouldSkipOpenThreadEmptySnapshot,
  shouldUseThreadPersistence,
} from "@/components/chat/use-chat-thread-state";

const TEST_IMAGE = [{ mimeType: "image/png", base64: "aaa" }] as const;

function testUserSend(content: string) {
  return {
    id: "user-1",
    content,
    messageType: "image" as const,
    attachments: [...TEST_IMAGE],
  };
}

test("auth draft and guest threads do not use persistence", () => {
  assert.equal(shouldUseThreadPersistence("auth:draft", "auth"), false);
  assert.equal(shouldUseThreadPersistence("auth:chat-1", "auth"), true);
  assert.equal(shouldUseThreadPersistence("guest:default", "guest"), false);
});

test("stale persisted draft reads do not reopen a moved thread", () => {
  const sendingState = reducer(createInitialThreadState("auth:draft"), {
    type: "startSend",
    chatKey: "auth:draft",
    payload: {
      userMessage: testUserSend("Hello"),
      assistantMessage: {
        id: "assistant-1",
      },
    },
  });

  const movedState = reducer(sendingState, {
    type: "moveThread",
    fromChatKey: "auth:draft",
    toChatKey: "auth:chat-1",
  });

  assert.equal(
    shouldOpenPersistedThread({
      requestedChatKey: "auth:draft",
      latestRequestedChatKey: "auth:chat-1",
      state: movedState,
    }),
    false,
  );
});

test("current requested thread can still open when the local state is empty", () => {
  const idleState = createInitialThreadState("auth:chat-1");

  assert.equal(
    shouldOpenPersistedThread({
      requestedChatKey: "auth:chat-1",
      latestRequestedChatKey: "auth:chat-1",
      state: idleState,
    }),
    true,
  );
});

test("shouldSkipOpenThreadEmptySnapshot blocks wiping hydrated auth thread with empty snapshot", () => {
  const hydrated = reducer(
    createInitialThreadState("auth:chat-1"),
    {
      type: "hydrateFromServer",
      chatKey: "auth:chat-1",
      messages: [
        {
          id: "m1",
          role: "user",
          messageType: "text",
          content: "hello",
          createdAt: "2026-03-30T00:00:00.000Z",
          state: "complete",
          synced: true,
        },
      ],
    },
  );

  assert.equal(
    shouldSkipOpenThreadEmptySnapshot("auth", "auth:chat-1", hydrated, undefined),
    true,
  );
  assert.equal(
    shouldSkipOpenThreadEmptySnapshot("auth", "auth:chat-1", hydrated, {
      version: 1,
      status: "idle",
      activeMessageId: null,
      messages: [],
    }),
    true,
  );
  assert.equal(
    shouldSkipOpenThreadEmptySnapshot("guest", "guest:default", hydrated, undefined),
    false,
  );
});

test("shouldSkipOpenThreadEmptySnapshot allows first open when thread is still empty", () => {
  const idle = createInitialThreadState("auth:chat-1");
  assert.equal(
    shouldSkipOpenThreadEmptySnapshot("auth", "auth:chat-1", idle, undefined),
    false,
  );
});

test("moveThread persists optimistic state for a remounted authenticated chat", async () => {
  const manifestStorage = new Map<string, string>();
  const snapshotStorage = new Map<string, ReturnType<typeof createInitialThreadState>>();
  const persistence = createThreadPersistenceSession(
    {
      getItem: (key) => manifestStorage.get(key) ?? null,
      setItem: (key, value) => {
        manifestStorage.set(key, value);
      },
      removeItem: (key) => {
        manifestStorage.delete(key);
      },
    },
    {
      async read(chatKey) {
        return snapshotStorage.get(chatKey);
      },
      async write(chatKey, snapshot) {
        snapshotStorage.set(chatKey, snapshot);
      },
      async clear(chatKey) {
        snapshotStorage.delete(chatKey);
      },
    },
  );

  const sendingState = reducer(createInitialThreadState("auth:draft"), {
    type: "startSend",
    chatKey: "auth:draft",
    payload: {
      userMessage: testUserSend("Hello"),
      assistantMessage: {
        id: "assistant-1",
      },
    },
  });

  const movedState = reducer(sendingState, {
    type: "moveThread",
    fromChatKey: "auth:draft",
    toChatKey: "auth:chat-1",
  });

  const failedState = reducer(movedState, {
    type: "failAssistant",
    chatKey: "auth:chat-1",
    messageId: "assistant-1",
    errorMessage: "Rate limited",
  });

  await persistMovedThread({
    persistence,
    state: failedState,
    fromChatKey: "auth:draft",
    toChatKey: "auth:chat-1",
    mode: "auth",
  });

  const reopened = await persistence.read("auth:chat-1", "auth");

  assert.ok(reopened);
  assert.equal(reopened.status, "error");
  assert.deepEqual(
    reopened.messages.map((message) => ({
      id: message.id,
      state: message.state,
      content: message.content,
    })),
    [
      { id: "user-1", state: "complete", content: "Hello" },
      { id: "assistant-1", state: "error", content: "" },
    ],
  );
});
