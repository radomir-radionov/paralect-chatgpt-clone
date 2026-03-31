import type {
  ChatThreadMessage,
  ChatThreadStatus,
} from "@/components/chat/chat-thread.types";
import type { ThreadSnapshotStore } from "@/components/chat/thread-snapshot-store";

const STORAGE_PREFIX = "chat-thread-state";

export type ThreadSnapshot = {
  version: 1;
  status: ChatThreadStatus;
  activeMessageId: string | null;
  messages: ChatThreadMessage[];
};

export type ThreadMode = "auth" | "guest";

export type ThreadSessionManifest = {
  version: 1;
  storage: "indexeddb";
  status: ChatThreadStatus;
  activeMessageId: string | null;
};

export type ThreadPersistencePayload = {
  manifest: ThreadSessionManifest;
  snapshot: ThreadSnapshot;
};

export type PersistableThreadState = {
  status: ChatThreadStatus;
  activeMessageId: string | null;
  messages: ChatThreadMessage[];
};

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type BuildThreadPersistencePayloadOptions = {
  mode: ThreadMode;
  status: ChatThreadStatus;
  activeMessageId: string | null;
  messages: ChatThreadMessage[];
};

export function isPendingMessage(message: ChatThreadMessage) {
  return !message.synced || message.state !== "complete";
}

export function hasPendingState(messages: ChatThreadMessage[]) {
  return messages.some(isPendingMessage);
}

/** Legacy persisted threads used status "done" after a successful stream; treat as idle. */
function migrateLegacyThreadStatus(
  status: ChatThreadStatus | "done",
): ChatThreadStatus {
  return status === "done" ? "idle" : status;
}

export function normalizeSnapshotForMode(
  snapshot: ThreadSnapshot | undefined,
  mode: ThreadMode,
): ThreadSnapshot | undefined {
  if (!snapshot) return undefined;

  const snapshotWithIdle = {
    ...snapshot,
    status: migrateLegacyThreadStatus(
      snapshot.status as ChatThreadStatus | "done",
    ),
  };

  if (
    (mode === "guest" || mode === "auth") &&
    (snapshotWithIdle.status === "sending" ||
      snapshotWithIdle.status === "streaming")
  ) {
    if (mode === "auth") {
      // Mid-flight snapshots are written while streaming. Mapping them to "error"
      // on reopen caused a visible flash before GET + hydrateFromServer (HMR/remount).
      return undefined;
    }
    const fallback =
      "Guest streaming was interrupted by a refresh. Send again to continue.";
    return {
      ...snapshotWithIdle,
      status: "error",
      messages: snapshotWithIdle.messages.map((message) =>
        message.state === "streaming"
          ? {
              ...message,
              state: "error",
              errorMessage: message.errorMessage ?? fallback,
            }
          : message,
      ),
    };
  }

  return snapshotWithIdle;
}

export function buildThreadPersistencePayload({
  mode,
  status,
  activeMessageId,
  messages,
}: BuildThreadPersistencePayloadOptions): ThreadPersistencePayload | null {
  if (messages.length === 0 && status === "idle" && activeMessageId === null) {
    return null;
  }

  const persistedMessages =
    mode === "guest" ? messages : messages.filter(isPendingMessage);

  if (persistedMessages.length === 0 && status !== "error") {
    return null;
  }

  return {
    manifest: {
      version: 1,
      storage: "indexeddb",
      status,
      activeMessageId,
    },
    snapshot: {
      version: 1,
      status,
      activeMessageId,
      messages: persistedMessages,
    },
  };
}

export function buildThreadPersistencePayloadFromState(
  mode: ThreadMode,
  state: PersistableThreadState,
): ThreadPersistencePayload | null {
  return buildThreadPersistencePayload({
    mode,
    status: state.status,
    activeMessageId: state.activeMessageId,
    messages: state.messages,
  });
}

function storageKey(chatKey: string) {
  return `${STORAGE_PREFIX}:${chatKey}`;
}

function parseThreadSessionManifest(raw: string | null): ThreadSessionManifest | undefined {
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<ThreadSessionManifest>;
    if (parsed.version !== 1 || parsed.storage !== "indexeddb") {
      return undefined;
    }

    return {
      version: 1,
      storage: "indexeddb",
      status: migrateLegacyThreadStatus(
        (parsed.status ?? "idle") as ChatThreadStatus | "done",
      ),
      activeMessageId: parsed.activeMessageId ?? null,
    };
  } catch {
    return undefined;
  }
}

export function createThreadPersistenceSession(
  sessionStorage: SessionStorageLike,
  snapshotStore: ThreadSnapshotStore,
) {
  return {
    async read(chatKey: string, mode: ThreadMode) {
      const manifest = parseThreadSessionManifest(
        sessionStorage.getItem(storageKey(chatKey)),
      );
      if (!manifest) return undefined;

      const snapshot = await snapshotStore.read(chatKey);
      if (!snapshot) return undefined;

      return normalizeSnapshotForMode(snapshot, mode);
    },

    async write(chatKey: string, payload: ThreadPersistencePayload) {
      sessionStorage.setItem(storageKey(chatKey), JSON.stringify(payload.manifest));
      await snapshotStore.write(chatKey, payload.snapshot);
    },

    async clear(chatKey: string) {
      sessionStorage.removeItem(storageKey(chatKey));
      await snapshotStore.clear(chatKey);
    },
  };
}

export type ThreadPersistenceSession = ReturnType<typeof createThreadPersistenceSession>;
