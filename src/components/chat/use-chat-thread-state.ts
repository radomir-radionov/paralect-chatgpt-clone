"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ChatMessageAttachment } from "@/lib/chat-api";
import type {
  ChatThreadMessage,
  ChatThreadStatus,
} from "@/components/chat/chat-thread.types";
import {
  buildThreadPersistencePayload,
  createThreadPersistenceSession,
  hasPendingState,
  normalizeSnapshotForMode,
  type ThreadMode,
  type ThreadSnapshot,
} from "@/components/chat/thread-persistence";
import { threadSnapshotStore } from "@/components/chat/thread-snapshot-store";

type ChatThreadState = {
  chatKey: string;
  messages: ChatThreadMessage[];
  status: ChatThreadStatus;
  activeMessageId: string | null;
};

type StartSendPayload = {
  userMessage: {
    id: string;
    content: string;
    attachments?: ChatMessageAttachment[];
    createdAt?: string;
    synced?: boolean;
  };
  assistantMessage: {
    id: string;
    createdAt?: string;
    synced?: boolean;
  };
};

type ChatThreadAction =
  | {
      type: "openThread";
      chatKey: string;
      mode: ThreadMode;
      snapshot?: ThreadSnapshot;
    }
  | {
      type: "hydrateFromServer";
      chatKey: string;
      messages: ChatThreadMessage[];
    }
  | {
      type: "startSend";
      chatKey: string;
      payload: StartSendPayload;
    }
  | {
      type: "appendAssistantChunk";
      chatKey: string;
      messageId: string;
      chunk: string;
    }
  | {
      type: "completeAssistant";
      chatKey: string;
      messageId: string;
    }
  | {
      type: "failAssistant";
      chatKey: string;
      messageId: string;
      errorMessage: string;
    };

type UseChatThreadStateOptions = {
  chatKey: string;
  mode: ThreadMode;
  serverMessages: ChatThreadMessage[];
  hydrateFromServer: boolean;
};

type UseChatThreadStateResult = {
  messages: ChatThreadMessage[];
  status: ChatThreadStatus;
  activeMessageId: string | null;
  hasPendingSync: boolean;
  startSend: (payload: StartSendPayload, targetChatKey?: string) => void;
  appendAssistantChunk: (
    messageId: string,
    chunk: string,
    targetChatKey?: string,
  ) => void;
  completeAssistant: (messageId: string, targetChatKey?: string) => void;
  failAssistant: (
    messageId: string,
    errorMessage: string,
    targetChatKey?: string,
  ) => void;
};

function dedupeById(messages: ChatThreadMessage[]) {
  const seen = new Set<string>();
  const out: ChatThreadMessage[] = [];
  for (const message of messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    out.push(message);
  }
  return out;
}

function mergeServerMessages(
  serverMessages: ChatThreadMessage[],
  currentMessages: ChatThreadMessage[],
) {
  const localById = new Map(currentMessages.map((message) => [message.id, message]));
  const mergedFromServer = serverMessages.map((message) => {
    const local = localById.get(message.id);
    if (!local) return message;

    if (
      local.role === "assistant" &&
      (local.state === "streaming" || local.state === "error") &&
      local.content.length > message.content.length
    ) {
      return {
        ...local,
        synced: false,
      };
    }

    return {
      ...message,
      errorMessage: local.state === "error" ? local.errorMessage : undefined,
    };
  });

  const serverIds = new Set(serverMessages.map((message) => message.id));
  const localOnly = currentMessages.filter((message) => !serverIds.has(message.id));

  return dedupeById([...mergedFromServer, ...localOnly]);
}

function initialStateForThread(
  chatKey: string,
  snapshot?: ThreadSnapshot,
  mode: ThreadMode = "auth",
): ChatThreadState {
  const normalizedSnapshot = normalizeSnapshotForMode(snapshot, mode);
  return {
    chatKey,
    messages: normalizedSnapshot?.messages ?? [],
    status: normalizedSnapshot?.status ?? "idle",
    activeMessageId: normalizedSnapshot?.activeMessageId ?? null,
  };
}

function reducer(state: ChatThreadState, action: ChatThreadAction): ChatThreadState {
  if (action.type === "openThread") {
    return initialStateForThread(action.chatKey, action.snapshot, action.mode);
  }

  const targetState =
    state.chatKey === action.chatKey ? state : initialStateForThread(action.chatKey);

  switch (action.type) {
    case "hydrateFromServer": {
      const messages = mergeServerMessages(action.messages, targetState.messages);
      const status =
        hasPendingState(messages)
          ? targetState.status
          : targetState.status === "done"
            ? "done"
            : "idle";
      return {
        ...targetState,
        messages,
        status,
      };
    }

    case "startSend": {
      const createdAt = new Date().toISOString();
      const userMessage: ChatThreadMessage = {
        id: action.payload.userMessage.id,
        role: "user",
        content: action.payload.userMessage.content,
        createdAt: action.payload.userMessage.createdAt ?? createdAt,
        attachments: action.payload.userMessage.attachments,
        state: "complete",
        synced: action.payload.userMessage.synced ?? false,
      };
      const assistantMessage: ChatThreadMessage = {
        id: action.payload.assistantMessage.id,
        role: "assistant",
        content: "",
        createdAt: action.payload.assistantMessage.createdAt ?? createdAt,
        state: "streaming",
        synced: action.payload.assistantMessage.synced ?? false,
      };
      return {
        ...targetState,
        messages: dedupeById([...targetState.messages, userMessage, assistantMessage]),
        status: "sending",
        activeMessageId: assistantMessage.id,
      };
    }

    case "appendAssistantChunk": {
      return {
        ...targetState,
        messages: targetState.messages.map((message) =>
          message.id === action.messageId
            ? {
                ...message,
                content: `${message.content}${action.chunk}`,
                state: "streaming",
                errorMessage: undefined,
              }
            : message,
        ),
        status: "streaming",
      };
    }

    case "completeAssistant": {
      return {
        ...targetState,
        messages: targetState.messages.map((message) =>
          message.id === action.messageId
            ? {
                ...message,
                state: "complete",
                errorMessage: undefined,
              }
            : message,
        ),
        status: "done",
        activeMessageId: null,
      };
    }

    case "failAssistant": {
      return {
        ...targetState,
        messages: targetState.messages.map((message) =>
          message.id === action.messageId
            ? {
                ...message,
                state: "error",
                errorMessage: action.errorMessage,
              }
            : message,
        ),
        status: "error",
        activeMessageId: action.messageId,
      };
    }
  }
}

export function useChatThreadState({
  chatKey,
  mode,
  serverMessages,
  hydrateFromServer,
}: UseChatThreadStateOptions): UseChatThreadStateResult {
  const [state, dispatch] = useReducer(reducer, initialStateForThread(chatKey, undefined, mode));
  const latestStateRef = useRef(state);
  const persistence = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createThreadPersistenceSession(window.sessionStorage, threadSnapshotStore);
  }, []);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!persistence) return;

    let cancelled = false;

    void (async () => {
      const latestState = latestStateRef.current;
      const shouldHydrate =
        latestState.chatKey !== chatKey ||
        (latestState.messages.length === 0 &&
          latestState.status === "idle" &&
          latestState.activeMessageId === null);

      if (!shouldHydrate) return;

      try {
        const snapshot = await persistence.read(chatKey, mode);
        if (cancelled) return;

        const currentState = latestStateRef.current;
        const shouldOpenThread =
          currentState.chatKey !== chatKey ||
          (currentState.messages.length === 0 &&
            currentState.status === "idle" &&
            currentState.activeMessageId === null);

        if (!shouldOpenThread) return;

        dispatch({
          type: "openThread",
          chatKey,
          mode,
          snapshot,
        });
      } catch {
        if (cancelled) return;
        dispatch({
          type: "openThread",
          chatKey,
          mode,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    chatKey,
    mode,
    persistence,
    state.activeMessageId,
    state.chatKey,
    state.messages.length,
    state.status,
  ]);

  useEffect(() => {
    if (!hydrateFromServer) return;
    dispatch({
      type: "hydrateFromServer",
      chatKey,
      messages: serverMessages,
    });
  }, [chatKey, hydrateFromServer, serverMessages]);

  useEffect(() => {
    if (!persistence) return;
    if (state.chatKey !== chatKey) return;

    const payload = buildThreadPersistencePayload({
      mode,
      status: state.status,
      activeMessageId: state.activeMessageId,
      messages: state.messages,
    });

    void (async () => {
      try {
        if (!payload) {
          await persistence.clear(chatKey);
          return;
        }

        await persistence.write(chatKey, payload);
      } catch {
        try {
          await persistence.clear(chatKey);
        } catch {
          // Best-effort persistence should never surface runtime errors.
        }
      }
    })();
  }, [chatKey, mode, persistence, state]);

  const result = useMemo(
    () => ({
      messages: state.messages,
      status: state.status,
      activeMessageId: state.activeMessageId,
      hasPendingSync: hasPendingState(state.messages),
    }),
    [state.activeMessageId, state.messages, state.status],
  );

  const startSend = useCallback(
    (payload: StartSendPayload, targetChatKey = chatKey) => {
      dispatch({
        type: "startSend",
        chatKey: targetChatKey,
        payload,
      });
    },
    [chatKey],
  );

  const appendAssistantChunk = useCallback(
    (messageId: string, chunk: string, targetChatKey = chatKey) => {
      dispatch({
        type: "appendAssistantChunk",
        chatKey: targetChatKey,
        messageId,
        chunk,
      });
    },
    [chatKey],
  );

  const completeAssistant = useCallback(
    (messageId: string, targetChatKey = chatKey) => {
      dispatch({
        type: "completeAssistant",
        chatKey: targetChatKey,
        messageId,
      });
    },
    [chatKey],
  );

  const failAssistant = useCallback(
    (messageId: string, errorMessage: string, targetChatKey = chatKey) => {
      dispatch({
        type: "failAssistant",
        chatKey: targetChatKey,
        messageId,
        errorMessage,
      });
    },
    [chatKey],
  );

  return {
    ...result,
    startSend,
    appendAssistantChunk,
    completeAssistant,
    failAssistant,
  };
}
