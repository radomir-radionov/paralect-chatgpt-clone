import type { QueryClient } from "@tanstack/react-query";

type ChatSyncMessage =
  | {
      readonly v: 1;
      readonly senderId: string;
      readonly type: "chat.invalidate";
      readonly roomId?: string;
    }
  | {
      readonly v: 1;
      readonly senderId: string;
      readonly type: "chat.invalidate.rooms";
    };

const CHANNEL_NAME = "paralect:chat-sync:v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function hasBroadcastChannel(): boolean {
  return isBrowser() && typeof BroadcastChannel !== "undefined";
}

// Per-tab id generated once when the module first loads in the browser. Every
// broadcast carries this id so the listener can ignore messages it sent
// itself. This is robust to HMR (where stale module instances may keep extra
// BroadcastChannel objects alive) and to any other scenario in which more
// than one channel of the same name exists in this tab.
const SENDER_ID = isBrowser()
  ? typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  : "";

// A single shared BroadcastChannel per tab is kept as an additional safeguard:
// per spec, a channel does not deliver to itself. The senderId filter is the
// primary mechanism though.
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (!hasBroadcastChannel()) return null;
  if (channel) return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastChatRoomsInvalidation(): void {
  getChannel()?.postMessage({
    v: 1,
    senderId: SENDER_ID,
    type: "chat.invalidate.rooms",
  } satisfies ChatSyncMessage);
}

export function broadcastChatInvalidation(options: {
  readonly roomId?: string;
}): void {
  getChannel()?.postMessage({
    v: 1,
    senderId: SENDER_ID,
    type: "chat.invalidate",
    roomId: options.roomId,
  } satisfies ChatSyncMessage);
}

function invalidateChatRooms(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: ["chat", "rooms"],
  });
}

function removeChatMessagesForRoom(queryClient: QueryClient, roomId: string) {
  queryClient.removeQueries({
    queryKey: ["chat", "messages", roomId],
  });
}

function removeChatRoom(queryClient: QueryClient, roomId: string) {
  queryClient.removeQueries({
    queryKey: ["chat", "room", roomId],
  });
}

function invalidateAllChat(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: ["chat"],
  });
}

export function registerChatCrossTabSync(queryClient: QueryClient): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const onMessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== "object" || data == null) return;

    const msg = data as Partial<ChatSyncMessage>;
    if (msg.v !== 1) return;
    if (typeof msg.senderId !== "string" || msg.senderId === SENDER_ID) return;

    if (msg.type === "chat.invalidate.rooms") {
      invalidateChatRooms(queryClient);
      return;
    }

    if (msg.type === "chat.invalidate") {
      if (typeof msg.roomId === "string" && msg.roomId.length > 0) {
        invalidateChatRooms(queryClient);
        removeChatRoom(queryClient, msg.roomId);
        removeChatMessagesForRoom(queryClient, msg.roomId);
      } else {
        invalidateAllChat(queryClient);
      }
    }
  };

  ch.addEventListener("message", onMessage);

  // Do not close() the channel on cleanup: it is shared with senders for
  // the lifetime of the tab. We only detach this listener.
  return () => {
    ch.removeEventListener("message", onMessage);
  };
}
