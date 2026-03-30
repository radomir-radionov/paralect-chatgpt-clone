"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { ChatMessageAttachment } from "@/lib/chat-api";
import type {
  ChatThreadMessage,
  ChatThreadStatus,
} from "@/components/chat/chat-thread.types";

type ThreadSnapshot = {
  version: 1;
  status: ChatThreadStatus;
  activeMessageId: string | null;
  messages: ChatThreadMessage[];
};

type ThreadMode = "auth" | "guest";

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

const STORAGE_PREFIX = "chat-thread-state";

function isPendingMessage(message: ChatThreadMessage) {
  return !message.synced || message.state !== "complete";
}

function hasPendingState(messages: ChatThreadMessage[]) {
  return messages.some(isPendingMessage);
}

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

function normalizeSnapshotForMode(
  snapshot: ThreadSnapshot | undefined,
  mode: ThreadMode,
): ThreadSnapshot | undefined {
  if (!snapshot) return undefined;

  if (mode === "guest" && (snapshot.status === "sending" || snapshot.status === "streaming")) {
    return {
      ...snapshot,
      status: "error" as const,
      messages: snapshot.messages.map((message) =>
        message.state === "streaming"
          ? {
              ...message,
              state: "error" as const,
              errorMessage:
                message.errorMessage ??
                "Guest streaming was interrupted by a refresh. Send again to continue.",
            }
          : message,
      ),
    };
  }

  return snapshot;
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

function storageKey(chatKey: string) {
  return `${STORAGE_PREFIX}:${chatKey}`;
}

function readSnapshot(chatKey: string) {
  if (typeof window === "undefined") return undefined;
  const raw = window.sessionStorage.getItem(storageKey(chatKey));
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as ThreadSnapshot;
    if (parsed.version !== 1) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeSnapshot(chatKey: string, snapshot: ThreadSnapshot) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(storageKey(chatKey), JSON.stringify(snapshot));
}

function clearSnapshot(chatKey: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey(chatKey));
}

export function useChatThreadState({
  chatKey,
  mode,
  serverMessages,
  hydrateFromServer,
}: UseChatThreadStateOptions): UseChatThreadStateResult {
  const [state, dispatch] = useReducer(reducer, initialStateForThread(chatKey, undefined, mode));

  useEffect(() => {
    const snapshot = readSnapshot(chatKey);
    if (
      state.chatKey === chatKey &&
      (!snapshot ||
        state.messages.length > 0 ||
        state.status !== "idle" ||
        state.activeMessageId !== null)
    ) {
      return;
    }
    dispatch({
      type: "openThread",
      chatKey,
      mode,
      snapshot,
    });
  }, [
    chatKey,
    mode,
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
    if (state.chatKey !== chatKey) return;

    if (mode === "guest") {
      writeSnapshot(chatKey, {
        version: 1,
        status: state.status,
        activeMessageId: state.activeMessageId,
        messages: state.messages,
      });
      return;
    }

    const pendingMessages = state.messages.filter(isPendingMessage);

    if (pendingMessages.length === 0 && state.status !== "error") {
      clearSnapshot(chatKey);
      return;
    }

    writeSnapshot(chatKey, {
      version: 1,
      status: state.status,
      activeMessageId: state.activeMessageId,
      messages: pendingMessages,
    });
  }, [chatKey, mode, state]);

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
