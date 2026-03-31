"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  ChatThreadMessage,
  ChatThreadStatus,
} from "@/components/chat/chat-thread.types";
import {
  buildThreadPersistencePayloadFromState,
  buildThreadPersistencePayload,
  createThreadPersistenceSession,
  hasPendingState,
  type ThreadPersistenceSession,
  type ThreadMode,
  type ThreadSnapshot,
} from "@/components/chat/thread-persistence";
import {
  type ChatThreadState,
  createInitialThreadState,
  reducer,
  type StartSendPayload,
} from "@/components/chat/thread-state";
import { threadSnapshotStore } from "@/components/chat/thread-snapshot-store";
import { logDebugIngest } from "@/lib/debug-ingest";

const hydrationIngestLogTimes = new Map<string, number>();
const HYDRATION_INGEST_DEDUPE_MS = 4_000;

function shouldLogHydrationIngest(signature: string) {
  const now = Date.now();
  const lastLoggedAt = hydrationIngestLogTimes.get(signature);
  if (lastLoggedAt !== undefined && now - lastLoggedAt < HYDRATION_INGEST_DEDUPE_MS) {
    return false;
  }
  hydrationIngestLogTimes.set(signature, now);
  return true;
}

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
  moveThread: (fromChatKey: string, toChatKey: string) => void;
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

function isTransientAuthDraftThread(chatKey: string, mode: ThreadMode) {
  return mode === "auth" && chatKey === "auth:draft";
}

export function shouldUseThreadPersistence(chatKey: string, mode: ThreadMode) {
  return !isTransientAuthDraftThread(chatKey, mode);
}

type ShouldOpenPersistedThreadOptions = {
  requestedChatKey: string;
  latestRequestedChatKey: string;
  state: ChatThreadState;
};

/** Avoid replacing a hydrated auth thread with an empty persistence read (defense in depth vs async races). */
export function shouldSkipOpenThreadEmptySnapshot(
  mode: ThreadMode,
  chatKey: string,
  state: ChatThreadState,
  snapshot: ThreadSnapshot | undefined,
): boolean {
  if (mode !== "auth") return false;
  if (state.chatKey !== chatKey) return false;
  if (state.messages.length === 0) return false;
  if (!snapshot) return true;
  return snapshot.messages.length === 0;
}

export function shouldOpenPersistedThread({
  requestedChatKey,
  latestRequestedChatKey,
  state,
}: ShouldOpenPersistedThreadOptions) {
  if (latestRequestedChatKey !== requestedChatKey) return false;
  if (
    state.chatKey === "auth:draft" &&
    requestedChatKey !== state.chatKey &&
    hasPendingState(state.messages)
  ) {
    return false;
  }
  return (
    state.chatKey !== requestedChatKey ||
    (state.messages.length === 0 &&
      state.status === "idle" &&
      state.activeMessageId === null)
  );
}

type PersistMovedThreadOptions = {
  persistence: ThreadPersistenceSession | null;
  state: ChatThreadState;
  fromChatKey: string;
  toChatKey: string;
  mode: ThreadMode;
};

export async function persistMovedThread({
  persistence,
  state,
  fromChatKey,
  toChatKey,
  mode,
}: PersistMovedThreadOptions) {
  if (!persistence) return;
  if (fromChatKey === toChatKey) return;

  const payload = shouldUseThreadPersistence(toChatKey, mode)
    ? buildThreadPersistencePayloadFromState(mode, state)
    : null;

  if (payload) {
    await persistence.write(toChatKey, payload);
  } else if (shouldUseThreadPersistence(toChatKey, mode)) {
    await persistence.clear(toChatKey);
  }

  await persistence.clear(fromChatKey);
}

export function useChatThreadState({
  chatKey,
  mode,
  serverMessages,
  hydrateFromServer,
}: UseChatThreadStateOptions): UseChatThreadStateResult {
  const [state, dispatch] = useReducer(
    reducer,
    createInitialThreadState(chatKey, undefined, mode),
  );
  const latestStateRef = useRef(state);
  const latestChatKeyRef = useRef(chatKey);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistence = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createThreadPersistenceSession(window.sessionStorage, threadSnapshotStore);
  }, []);

  // Keep refs aligned with the latest render so async persistence callbacks never see stale state
  // before useEffect runs (fixes hydrateFromServer then openThread wiping messages).
  latestStateRef.current = state;
  latestChatKeyRef.current = chatKey;

  useEffect(() => {
    if (!persistence) return;

    if (!shouldUseThreadPersistence(chatKey, mode)) {
      dispatch({
        type: "openThread",
        chatKey,
        mode,
      });
      void persistence.clear(chatKey).catch(() => {
        // Ignore stale draft cleanup failures; they should not block rendering.
      });
      return;
    }

    let cancelled = false;

    void (async () => {
      const latestState = latestStateRef.current;
      const shouldHydrate = shouldOpenPersistedThread({
        requestedChatKey: chatKey,
        latestRequestedChatKey: latestChatKeyRef.current,
        state: latestState,
      });

      if (!shouldHydrate) return;

      try {
        const snapshot = await persistence.read(chatKey, mode);
        if (cancelled) return;

        const currentState = latestStateRef.current;
        const shouldOpenThread = shouldOpenPersistedThread({
          requestedChatKey: chatKey,
          latestRequestedChatKey: latestChatKeyRef.current,
          state: currentState,
        });

        if (!shouldOpenThread) return;

        if (
          shouldSkipOpenThreadEmptySnapshot(mode, chatKey, currentState, snapshot)
        ) {
          return;
        }

        dispatch({
          type: "openThread",
          chatKey,
          mode,
          snapshot,
        });
      } catch {
        if (cancelled) return;
        const afterError = latestStateRef.current;
        if (
          shouldSkipOpenThreadEmptySnapshot(mode, chatKey, afterError, undefined)
        ) {
          return;
        }
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
    // State deps intentionally omitted: latestStateRef/latestChatKeyRef provide stale-free
    // reads without causing this effect to re-run on every streaming token.
  }, [chatKey, mode, persistence]);

  useEffect(() => {
    if (!hydrateFromServer) return;
    const latestServerMessageId = serverMessages.at(-1)?.id ?? "none";
    const hydrationSignature = `${chatKey}:${serverMessages.length}:${latestServerMessageId}`;
    if (shouldLogHydrationIngest(hydrationSignature)) {
      logDebugIngest({
        sessionId: "d6f539",
        runId: "initial-debug",
        hypothesisId: "H2-H4",
        location: "src/components/chat/use-chat-thread-state.ts:hydrateFromServer",
        message: "hydrateFromServer dispatching",
        data: {
          chatKey,
          serverMessageCount: serverMessages.length,
          localMessageCount: latestStateRef.current.messages.length,
          localStatus: latestStateRef.current.status,
          hydrationSignature,
        },
      });
    }
    dispatch({
      type: "hydrateFromServer",
      chatKey,
      messages: serverMessages,
    });
  }, [chatKey, hydrateFromServer, serverMessages]);

  useEffect(() => {
    if (!persistence) return;
    if (state.chatKey !== chatKey) return;

    if (!shouldUseThreadPersistence(chatKey, mode)) {
      void persistence.clear(chatKey).catch(() => {
        // Best-effort cleanup for transient draft snapshots.
      });
      return;
    }

    // Debounce writes: during streaming every token produces a new state reference.
    // We only need to persist when state settles, not on every individual token.
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
    }

    const capturedStatus = state.status;
    const capturedActiveMessageId = state.activeMessageId;
    const capturedMessages = state.messages;

    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;

      const payload = buildThreadPersistencePayload({
        mode,
        status: capturedStatus,
        activeMessageId: capturedActiveMessageId,
        messages: capturedMessages,
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
    }, 400);

    return () => {
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
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

  const moveThread = useCallback((fromChatKey: string, toChatKey: string) => {
    const currentState = latestStateRef.current;
    logDebugIngest({
      sessionId: "d6f539",
      runId: "initial-debug",
      hypothesisId: "H3-H4",
      location: "src/components/chat/use-chat-thread-state.ts:270",
      message: "moveThread called",
      data: {
        fromChatKey,
        toChatKey,
        currentChatKey: currentState.chatKey,
        messageCount: currentState.messages.length,
        status: currentState.status,
      },
    });
    dispatch({
      type: "moveThread",
      fromChatKey,
      toChatKey,
    });
    if (!persistence) return;
    void persistMovedThread({
      persistence,
      state: currentState,
      fromChatKey,
      toChatKey,
      mode,
    }).catch(() => {
      // Best-effort cleanup for stale draft snapshots.
    });
  }, [mode, persistence]);

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
    moveThread,
    appendAssistantChunk,
    completeAssistant,
    failAssistant,
  };
}
