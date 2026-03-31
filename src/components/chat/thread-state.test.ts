import test from "node:test";
import assert from "node:assert/strict";
import type { ChatThreadMessage } from "@/components/chat/chat-thread.types";
import {
  createInitialThreadState,
  mergeServerMessages,
  reducer,
  shouldPollPendingSync,
} from "@/components/chat/thread-state";
import { normalizeSnapshotForMode } from "@/components/chat/thread-persistence";
import { shouldOpenPersistedThread } from "@/components/chat/use-chat-thread-state";

const TEST_IMAGE = [{ mimeType: "image/png", base64: "aaa" }] as const;

function testUserSend(content: string, id = "user-1") {
  return {
    id,
    content,
    messageType: "image" as const,
    attachments: [...TEST_IMAGE],
  };
}

function createMessage(
  overrides: Partial<ChatThreadMessage> & Pick<ChatThreadMessage, "id" | "role" | "content">,
): ChatThreadMessage {
  const role = overrides.role;
  const defaultMessageType: ChatThreadMessage["messageType"] =
    role === "assistant"
      ? "text"
      : overrides.attachments?.length
        ? "image"
        : "text";
  return {
    createdAt: "2026-03-30T00:00:00.000Z",
    state: "complete",
    synced: true,
    messageType: defaultMessageType,
    ...overrides,
  };
}

test("mergeServerMessages keeps errored assistant messages in their original position", () => {
  const currentMessages: ChatThreadMessage[] = [
    createMessage({
      id: "server-user-1",
      role: "user",
      content: "hello",
    }),
    createMessage({
      id: "local-assistant-error",
      role: "assistant",
      content: "temporary failure",
      state: "error",
      synced: false,
      errorMessage: "The selected AI model is temporarily rate-limited.",
    }),
    createMessage({
      id: "server-user-2",
      role: "user",
      content: "how are you",
    }),
    createMessage({
      id: "server-assistant-2",
      role: "assistant",
      content: "I'm doing well.",
    }),
  ];

  const serverMessages: ChatThreadMessage[] = [
    createMessage({
      id: "server-user-1",
      role: "user",
      content: "hello",
    }),
    createMessage({
      id: "server-user-2",
      role: "user",
      content: "how are you",
    }),
    createMessage({
      id: "server-assistant-2",
      role: "assistant",
      content: "I'm doing well.",
    }),
  ];

  const merged = mergeServerMessages(serverMessages, currentMessages);

  assert.deepEqual(
    merged.map((message) => message.id),
    [
      "server-user-1",
      "local-assistant-error",
      "server-user-2",
      "server-assistant-2",
    ],
  );
});

test("mergeServerMessages preserves assistant error when server row shares the same id", () => {
  const currentMessages: ChatThreadMessage[] = [
    createMessage({
      id: "user-1",
      role: "user",
      content: "hello",
    }),
    createMessage({
      id: "assistant-1",
      role: "assistant",
      content: "",
      state: "error",
      synced: false,
      errorMessage: "The selected AI model is temporarily rate-limited.",
    }),
  ];

  const serverMessages: ChatThreadMessage[] = [
    createMessage({
      id: "user-1",
      role: "user",
      content: "hello",
    }),
    createMessage({
      id: "assistant-1",
      role: "assistant",
      content: "",
      state: "complete",
      synced: true,
    }),
  ];

  const merged = mergeServerMessages(serverMessages, currentMessages);
  const assistant = merged.find((m) => m.id === "assistant-1");
  assert.equal(assistant?.state, "error");
  assert.equal(
    assistant?.errorMessage,
    "The selected AI model is temporarily rate-limited.",
  );
  assert.equal(assistant?.synced, false);
});

test("startSend after failAssistant keeps failed turn and appends the next attempt", () => {
  const state = createInitialThreadState("auth:chat-1");
  const afterFirst = reducer(state, {
    type: "startSend",
    chatKey: "auth:chat-1",
    payload: {
      userMessage: testUserSend("hello"),
      assistantMessage: { id: "assistant-1" },
    },
  });
  const afterFail = reducer(afterFirst, {
    type: "failAssistant",
    chatKey: "auth:chat-1",
    messageId: "assistant-1",
    errorMessage: "Streaming was interrupted. Send again to continue.",
  });
  const afterRetry = reducer(afterFail, {
    type: "startSend",
    chatKey: "auth:chat-1",
    payload: {
      userMessage: testUserSend("hello", "user-2"),
      assistantMessage: { id: "assistant-2" },
    },
  });

  assert.equal(afterRetry.messages.length, 4);
  assert.deepEqual(
    afterRetry.messages.map((m) => m.id),
    ["user-1", "assistant-1", "user-2", "assistant-2"],
  );
  assert.equal(afterRetry.messages[0]?.content, "hello");
  assert.equal(afterRetry.messages[1]?.state, "error");
  assert.equal(afterRetry.messages[2]?.content, "hello");
  assert.equal(afterRetry.messages[3]?.state, "streaming");
});

test("startSend after failAssistant keeps older complete turns and the failed turn before appending", () => {
  const state = createInitialThreadState("auth:chat-1");
  const s1 = reducer(state, {
    type: "startSend",
    chatKey: "auth:chat-1",
    payload: {
      userMessage: testUserSend("first", "user-1"),
      assistantMessage: { id: "assistant-1" },
    },
  });
  const s2 = reducer(s1, {
    type: "completeAssistant",
    chatKey: "auth:chat-1",
    messageId: "assistant-1",
  });
  const s3 = reducer(s2, {
    type: "startSend",
    chatKey: "auth:chat-1",
    payload: {
      userMessage: testUserSend("second", "user-2"),
      assistantMessage: { id: "assistant-2" },
    },
  });
  const s4 = reducer(s3, {
    type: "failAssistant",
    chatKey: "auth:chat-1",
    messageId: "assistant-2",
    errorMessage: "Rate limited.",
  });
  const afterRetry = reducer(s4, {
    type: "startSend",
    chatKey: "auth:chat-1",
    payload: {
      userMessage: testUserSend("retry", "user-3"),
      assistantMessage: { id: "assistant-3" },
    },
  });

  assert.deepEqual(
    afterRetry.messages.map((m) => m.id),
    [
      "user-1",
      "assistant-1",
      "user-2",
      "assistant-2",
      "user-3",
      "assistant-3",
    ],
  );
  assert.equal(afterRetry.messages[4]?.content, "retry");
  assert.equal(afterRetry.messages[5]?.state, "streaming");
});

test("normalizeSnapshotForMode auth discards mid-flight snapshot so hydrate can replace", () => {
  const snapshot = {
    version: 1 as const,
    status: "streaming" as const,
    activeMessageId: "assistant-1",
    messages: [
      createMessage({
        id: "user-1",
        role: "user",
        content: "hello",
      }),
      createMessage({
        id: "assistant-1",
        role: "assistant",
        content: "",
        state: "streaming",
        synced: false,
      }),
    ],
  };

  const out = normalizeSnapshotForMode(snapshot, "auth");
  assert.equal(out, undefined);
});

test("mergeServerMessages keeps server-only older history ahead of local-only errors", () => {
  const currentMessages: ChatThreadMessage[] = [
    createMessage({
      id: "server-user-1",
      role: "user",
      content: "hello",
    }),
    createMessage({
      id: "local-assistant-error",
      role: "assistant",
      content: "temporary failure",
      state: "error",
      synced: false,
      errorMessage: "The selected AI model is temporarily rate-limited.",
    }),
  ];

  const serverMessages: ChatThreadMessage[] = [
    createMessage({
      id: "older-server-user",
      role: "user",
      content: "earlier message",
    }),
    createMessage({
      id: "server-user-1",
      role: "user",
      content: "hello",
    }),
  ];

  const merged = mergeServerMessages(serverMessages, currentMessages);

  assert.deepEqual(
    merged.map((message) => message.id),
    ["older-server-user", "server-user-1", "local-assistant-error"],
  );
});

function createServerMessage(
  overrides: Partial<ChatThreadMessage>,
): ChatThreadMessage {
  const merged = {
    id: "message-id",
    role: "assistant" as const,
    content: "",
    createdAt: "2026-03-30T00:00:00.000Z",
    state: "complete" as const,
    synced: true,
    ...overrides,
  };
  const messageType: ChatThreadMessage["messageType"] =
    merged.messageType ??
    (merged.role === "assistant"
      ? "text"
      : merged.attachments?.length
        ? "image"
        : "text");
  return { ...merged, messageType };
}

test("hydrateFromServer leaves state unchanged when chatKey mismatches", () => {
  const state = createInitialThreadState("auth:chat-a");
  const withMessage = reducer(state, {
    type: "startSend",
    chatKey: "auth:chat-a",
    payload: {
      userMessage: testUserSend("hello"),
      assistantMessage: { id: "assistant-1" },
    },
  });
  const hydrated = reducer(withMessage, {
    type: "hydrateFromServer",
    chatKey: "auth:chat-b",
    messages: [],
  });
  assert.deepEqual(
    hydrated.messages.map((m) => m.id),
    withMessage.messages.map((m) => m.id),
  );
  assert.equal(hydrated.chatKey, "auth:chat-a");
});

test("hydrate preserves longer local assistant content until server catches up", () => {
  const state = createInitialThreadState("auth:chat-1");

  const sendingState = reducer(state, {
    type: "startSend",
    chatKey: "auth:chat-1",
    payload: {
      userMessage: testUserSend("Hello"),
      assistantMessage: {
        id: "assistant-1",
      },
    },
  });

  const streamedState = reducer(sendingState, {
    type: "appendAssistantChunk",
    chatKey: "auth:chat-1",
    messageId: "assistant-1",
    chunk: "Longer local assistant response",
  });

  const completedState = reducer(streamedState, {
    type: "completeAssistant",
    chatKey: "auth:chat-1",
    messageId: "assistant-1",
  });

  const hydratedState = reducer(completedState, {
    type: "hydrateFromServer",
    chatKey: "auth:chat-1",
    messages: [
      createServerMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
      }),
      createServerMessage({
        id: "assistant-1",
        content: "Short",
      }),
    ],
  });

  assert.equal(hydratedState.messages[1]?.content, "Longer local assistant response");
  assert.equal(hydratedState.messages[1]?.synced, false);
});

test("hydrate marks assistant synced when the persisted message matches", () => {
  const state = createInitialThreadState("auth:chat-1");

  const sendingState = reducer(state, {
    type: "startSend",
    chatKey: "auth:chat-1",
    payload: {
      userMessage: testUserSend("Hello"),
      assistantMessage: {
        id: "assistant-1",
      },
    },
  });

  const streamedState = reducer(sendingState, {
    type: "appendAssistantChunk",
    chatKey: "auth:chat-1",
    messageId: "assistant-1",
    chunk: "Exact persisted assistant response",
  });

  const completedState = reducer(streamedState, {
    type: "completeAssistant",
    chatKey: "auth:chat-1",
    messageId: "assistant-1",
  });

  const hydratedState = reducer(completedState, {
    type: "hydrateFromServer",
    chatKey: "auth:chat-1",
    messages: [
      createServerMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
      }),
      createServerMessage({
        id: "assistant-1",
        content: "Exact persisted assistant response",
      }),
    ],
  });

  assert.equal(hydratedState.messages[1]?.content, "Exact persisted assistant response");
  assert.equal(hydratedState.messages[1]?.synced, true);
  assert.equal(hydratedState.status, "idle");
});

test("moveThread keeps optimistic messages when draft chat becomes persisted", () => {
  const state = createInitialThreadState("auth:draft");

  const sendingState = reducer(state, {
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

  assert.equal(movedState.chatKey, "auth:chat-1");
  assert.equal(movedState.status, "sending");
  assert.deepEqual(
    movedState.messages.map((message) => message.id),
    ["user-1", "assistant-1"],
  );
});

test("moveThread keeps first-message attachments after a failed send", () => {
  const state = createInitialThreadState("auth:draft");

  const sendingState = reducer(state, {
    type: "startSend",
    chatKey: "auth:draft",
    payload: {
      userMessage: {
        id: "user-1",
        content: "What do you see?",
        messageType: "image",
        attachments: [
          {
            mimeType: "image/png",
            base64: "abc123",
          },
        ],
      },
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

  assert.equal(failedState.chatKey, "auth:chat-1");
  assert.deepEqual(failedState.messages[0]?.attachments, [
    {
      mimeType: "image/png",
      base64: "abc123",
    },
  ]);
  assert.equal(failedState.messages[1]?.state, "error");
  assert.equal(failedState.messages[1]?.errorMessage, "Rate limited");
});

test("stale draft chunks are ignored after the thread moves to a real chat id", () => {
  const state = createInitialThreadState("auth:draft");

  const sendingState = reducer(state, {
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

  const staleChunkState = reducer(movedState, {
    type: "appendAssistantChunk",
    chatKey: "auth:draft",
    messageId: "assistant-1",
    chunk: "stale chunk",
  });

  assert.equal(staleChunkState.chatKey, "auth:chat-1");
  assert.equal(staleChunkState.status, "sending");
  assert.equal(
    staleChunkState.messages.find((message) => message.id === "assistant-1")?.content,
    "",
  );
});

test("stale draft completion is ignored after the thread moves to a real chat id", () => {
  const state = createInitialThreadState("auth:draft");

  const sendingState = reducer(state, {
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

  const staleCompleteState = reducer(movedState, {
    type: "completeAssistant",
    chatKey: "auth:draft",
    messageId: "assistant-1",
  });

  assert.equal(staleCompleteState.chatKey, "auth:chat-1");
  assert.equal(staleCompleteState.status, "sending");
  assert.equal(staleCompleteState.activeMessageId, "assistant-1");
});

test("pending sync polling waits until optimistic streaming is settled", () => {
  assert.equal(
    shouldPollPendingSync({
      hasPendingSync: true,
      status: "sending",
      userId: "user-1",
      chatId: "chat-1",
    }),
    false,
  );
  assert.equal(
    shouldPollPendingSync({
      hasPendingSync: true,
      status: "streaming",
      userId: "user-1",
      chatId: "chat-1",
    }),
    false,
  );
  assert.equal(
    shouldPollPendingSync({
      hasPendingSync: true,
      status: "idle",
      userId: "user-1",
      chatId: "chat-1",
    }),
    true,
  );
});

test("shouldOpenPersistedThread does not wipe pending draft messages during chat creation", () => {
  const draftState = reducer(createInitialThreadState("auth:draft"), {
    type: "startSend",
    chatKey: "auth:draft",
    payload: {
      userMessage: testUserSend("Hello"),
      assistantMessage: {
        id: "assistant-1",
      },
    },
  });

  assert.equal(
    shouldOpenPersistedThread({
      requestedChatKey: "auth:chat-1",
      latestRequestedChatKey: "auth:chat-1",
      state: draftState,
    }),
    false,
  );
});
