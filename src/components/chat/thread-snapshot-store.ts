import type { ThreadSnapshot } from "@/components/chat/thread-persistence";

const THREAD_SNAPSHOT_DB_NAME = "chat-thread-state";
const THREAD_SNAPSHOT_STORE_NAME = "thread-snapshots";
const THREAD_SNAPSHOT_DB_VERSION = 1;

type ThreadSnapshotRecord = {
  chatKey: string;
  snapshot: ThreadSnapshot;
};

export type ThreadSnapshotStore = {
  read: (chatKey: string) => Promise<ThreadSnapshot | undefined>;
  write: (chatKey: string, snapshot: ThreadSnapshot) => Promise<void>;
  clear: (chatKey: string) => Promise<void>;
};

function requestToPromise<Result>(request: IDBRequest<Result>) {
  return new Promise<Result>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function openThreadSnapshotDatabase(indexedDb: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(
      THREAD_SNAPSHOT_DB_NAME,
      THREAD_SNAPSHOT_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(THREAD_SNAPSHOT_STORE_NAME)) {
        database.createObjectStore(THREAD_SNAPSHOT_STORE_NAME, {
          keyPath: "chatKey",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open snapshot database"));
  });
}

export function createIndexedDbThreadSnapshotStore(
  indexedDb: IDBFactory | null | undefined,
): ThreadSnapshotStore {
  let databasePromise: Promise<IDBDatabase> | null = null;

  async function getDatabase() {
    if (!indexedDb) return undefined;
    if (!databasePromise) {
      databasePromise = openThreadSnapshotDatabase(indexedDb);
    }
    return databasePromise;
  }

  return {
    async read(chatKey) {
      const database = await getDatabase();
      if (!database) return undefined;

      const transaction = database.transaction(THREAD_SNAPSHOT_STORE_NAME, "readonly");
      const store = transaction.objectStore(THREAD_SNAPSHOT_STORE_NAME);
      const record = (await requestToPromise(
        store.get(chatKey) as IDBRequest<ThreadSnapshotRecord | ThreadSnapshot | undefined>,
      )) as ThreadSnapshotRecord | ThreadSnapshot | undefined;
      await transactionToPromise(transaction);

      if (!record) return undefined;
      if ("snapshot" in record) return record.snapshot;
      return record;
    },

    async write(chatKey, snapshot) {
      const database = await getDatabase();
      if (!database) return;

      const transaction = database.transaction(THREAD_SNAPSHOT_STORE_NAME, "readwrite");
      const store = transaction.objectStore(THREAD_SNAPSHOT_STORE_NAME);
      store.put({
        chatKey,
        snapshot,
      } satisfies ThreadSnapshotRecord);
      await transactionToPromise(transaction);
    },

    async clear(chatKey) {
      const database = await getDatabase();
      if (!database) return;

      const transaction = database.transaction(THREAD_SNAPSHOT_STORE_NAME, "readwrite");
      const store = transaction.objectStore(THREAD_SNAPSHOT_STORE_NAME);
      store.delete(chatKey);
      await transactionToPromise(transaction);
    },
  };
}

export const threadSnapshotStore = createIndexedDbThreadSnapshotStore(
  typeof window === "undefined" ? undefined : window.indexedDB,
);
