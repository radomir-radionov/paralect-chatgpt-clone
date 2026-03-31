const GUEST_CHAT_KEY = "guest:default";
const GUEST_THREAD_STORAGE_KEY = "chat-thread-state:guest:default";

type SessionStorageLike = Pick<Storage, "removeItem">;
type ThreadSnapshotClearer = {
  clear: (chatKey: string) => Promise<void>;
};

export async function clearGuestThreadState(
  sessionStorage: SessionStorageLike,
  snapshotStore: ThreadSnapshotClearer,
): Promise<void> {
  sessionStorage.removeItem(GUEST_THREAD_STORAGE_KEY);
  await snapshotStore.clear(GUEST_CHAT_KEY);
}
