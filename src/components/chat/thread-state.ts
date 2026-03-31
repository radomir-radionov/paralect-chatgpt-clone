"use client";

/**
 * Messaging model (see also thread-persistence `synced`):
 *
 * Thread `status` (ChatThreadStatus): idle → sending → streaming → idle on success, or error.
 * Message `state` (per row): user messages are complete immediately; assistant goes streaming →
 * complete | error. `synced` flips true when merged from server; assistants stay unsynced until
 * then so merge can keep longer local text (`shouldKeepLocalAssistant`). Polling uses
 * hasPendingState until user rows are confirmed too.
 *
 * Flow: startSend → appendAssistantChunk* → completeAssistant | failAssistant → hydrateFromServer
 * when React Query refetches server messages.
 */

import type { ChatMessageAttachment } from "@/lib/chat-api";
import type {
  ChatThreadMessage,
  ChatThreadStatus,
} from "@/components/chat/chat-thread.types";
import { hasPendingState, normalizeSnapshotForMode } from "@/components/chat/thread-persistence";
import type { ThreadMode, ThreadSnapshot } from "@/components/chat/thread-persistence";

export type ChatThreadState = {
  chatKey: string;
  messages: ChatThreadMessage[];
  status: ChatThreadStatus;
  activeMessageId: string | null;
};

export type StartSendPayload = {
  userMessage: {
    id: string;
    content: string;
    messageType: "image" | "text";
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

export type ChatThreadAction =
  | {
      type: "openThread";
      chatKey: string;
      mode: ThreadMode;
      snapshot?: ThreadSnapshot;
    }
  | {
      type: "moveThread";
      fromChatKey: string;
      toChatKey: string;
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

function shouldKeepLocalAssistant(
  local: ChatThreadMessage,
  server: ChatThreadMessage,
) {
  return (
    local.role === "assistant" &&
    !local.synced &&
    local.content.length > server.content.length
  );
}

function mergeMessage(local: ChatThreadMessage | undefined, server: ChatThreadMessage) {
  if (!local) return server;

  if (shouldKeepLocalAssistant(local, server)) {
    return {
      ...local,
      errorMessage: local.state === "error" ? local.errorMessage : undefined,
      synced: false,
    };
  }

  if (local.role === "assistant" && local.state === "error") {
    return {
      ...server,
      content: server.content.length >= local.content.length ? server.content : local.content,
      state: "error" as const,
      errorMessage: local.errorMessage,
      synced: false,
    };
  }

  return {
    ...server,
    errorMessage: local.state === "error" ? local.errorMessage : undefined,
    state: "complete" as const,
    synced: true,
  };
}

function insertMessageNearNeighbors(
  messages: ChatThreadMessage[],
  message: ChatThreadMessage,
  currentMessages: ChatThreadMessage[],
  placedIds: Set<string>,
) {
  const currentIndex = currentMessages.findIndex(
    (currentMessage) => currentMessage.id === message.id,
  );
  if (currentIndex === -1) {
    messages.push(message);
    placedIds.add(message.id);
    return messages;
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const previousId = currentMessages[index]?.id;
    if (!previousId || !placedIds.has(previousId)) continue;

    const insertAt = messages.findIndex(
      (currentMessage) => currentMessage.id === previousId,
    );
    if (insertAt !== -1) {
      messages.splice(insertAt + 1, 0, message);
      placedIds.add(message.id);
      return messages;
    }
  }

  for (let index = currentIndex + 1; index < currentMessages.length; index += 1) {
    const nextId = currentMessages[index]?.id;
    if (!nextId || !placedIds.has(nextId)) continue;

    const insertAt = messages.findIndex(
      (currentMessage) => currentMessage.id === nextId,
    );
    if (insertAt !== -1) {
      messages.splice(insertAt, 0, message);
      placedIds.add(message.id);
      return messages;
    }
  }

  messages.push(message);
  placedIds.add(message.id);
  return messages;
}

export function mergeServerMessages(
  serverMessages: ChatThreadMessage[],
  currentMessages: ChatThreadMessage[],
) {
  const localById = new Map(currentMessages.map((message) => [message.id, message]));
  const mergedFromServer = serverMessages.map((message) =>
    mergeMessage(localById.get(message.id), message),
  );

  const serverIds = new Set(serverMessages.map((message) => message.id));
  const placedIds = new Set(mergedFromServer.map((message) => message.id));

  return dedupeById(
    currentMessages
      .filter((message) => !serverIds.has(message.id))
      .reduce(
        (messages, message) =>
          insertMessageNearNeighbors(messages, message, currentMessages, placedIds),
        [...mergedFromServer],
      ),
  );
}

export function createInitialThreadState(
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

/** When action targets a different key than current state, start from an empty thread for that key. */
function resolveTargetStateForAction(
  state: ChatThreadState,
  action: ChatThreadAction,
): ChatThreadState {
  if (!("chatKey" in action)) return state;
  return state.chatKey === action.chatKey
    ? state
    : createInitialThreadState(action.chatKey);
}

export function reducer(
  state: ChatThreadState,
  action: ChatThreadAction,
): ChatThreadState {
  if (action.type === "openThread") {
    return createInitialThreadState(action.chatKey, action.snapshot, action.mode);
  }

  if (
    action.type === "moveThread" &&
    state.chatKey === action.fromChatKey
  ) {
    return {
      ...state,
      chatKey: action.toChatKey,
    };
  }

  if (
    "chatKey" in action &&
    state.chatKey !== action.chatKey &&
    action.type !== "hydrateFromServer" &&
    action.type !== "startSend"
  ) {
    return state;
  }

  const targetState = resolveTargetStateForAction(state, action);

  switch (action.type) {
    case "hydrateFromServer": {
      if (state.chatKey !== action.chatKey) {
        return state;
      }
      const messages = mergeServerMessages(action.messages, state.messages);
      const status = hasPendingState(messages)
        ? state.status
        : "idle";
      return {
        ...state,
        messages,
        status,
      };
    }

    case "startSend": {
      const prior = targetState.messages;

      const createdAt = new Date().toISOString();
      const userMessage: ChatThreadMessage = {
        id: action.payload.userMessage.id,
        role: "user",
        messageType: action.payload.userMessage.messageType,
        content: action.payload.userMessage.content,
        createdAt: action.payload.userMessage.createdAt ?? createdAt,
        attachments: action.payload.userMessage.attachments,
        state: "complete",
        synced: action.payload.userMessage.synced ?? false,
      };
      const assistantMessage: ChatThreadMessage = {
        id: action.payload.assistantMessage.id,
        role: "assistant",
        messageType: "text",
        content: "",
        createdAt: action.payload.assistantMessage.createdAt ?? createdAt,
        state: "streaming",
        synced: action.payload.assistantMessage.synced ?? false,
      };
      return {
        ...targetState,
        messages: dedupeById([...prior, userMessage, assistantMessage]),
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
        status: "idle",
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

    default:
      return state;
  }
}

type ShouldPollPendingSyncOptions = {
  userId?: string;
  chatId?: string;
  hasPendingSync: boolean;
  status: ChatThreadStatus;
};

export function shouldPollPendingSync({
  userId,
  chatId,
  hasPendingSync,
  status,
}: ShouldPollPendingSyncOptions) {
  if (!userId || !chatId || !hasPendingSync) return false;
  return status !== "sending" && status !== "streaming";
}
