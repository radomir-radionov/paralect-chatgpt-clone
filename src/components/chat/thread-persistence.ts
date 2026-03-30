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

export function normalizeSnapshotForMode(
  snapshot: ThreadSnapshot | undefined,
  mode: ThreadMode,
): ThreadSnapshot | undefined {
  if (!snapshot) return undefined;

  if (mode === "guest" && (snapshot.status === "sending" || snapshot.status === "streaming")) {
    return {
      ...snapshot,
      status: "error",
      messages: snapshot.messages.map((message) =>
        message.state === "streaming"
          ? {
              ...message,
              state: "error",
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
      status: parsed.status ?? "idle",
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
