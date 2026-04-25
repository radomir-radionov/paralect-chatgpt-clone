import type { QueryClient } from "@tanstack/react-query";

type ChatSyncMessage =
  | {
      readonly v: 1;
      readonly type: "chat.invalidate";
      readonly roomId?: string;
    }
  | {
      readonly v: 1;
      readonly type: "chat.invalidate.rooms";
    };

const CHANNEL_NAME = "paralect:chat-sync:v1";
let sender: BroadcastChannel | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function hasBroadcastChannel(): boolean {
  return isBrowser() && typeof BroadcastChannel !== "undefined";
}

function getSender(): BroadcastChannel | null {
  if (!hasBroadcastChannel()) return null;
  if (sender) return sender;
  sender = new BroadcastChannel(CHANNEL_NAME);
  return sender;
}

export function broadcastChatRoomsInvalidation(): void {
  const channel = getSender();
  if (!channel) return;
  channel.postMessage({ v: 1, type: "chat.invalidate.rooms" } satisfies ChatSyncMessage);
}

export function broadcastChatInvalidation(options: {
  readonly roomId?: string;
}): void {
  const channel = getSender();
  if (!channel) return;
  channel.postMessage({
    v: 1,
    type: "chat.invalidate",
    roomId: options.roomId,
  } satisfies ChatSyncMessage);
}

function invalidateChatRooms(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: ["chat", "rooms"],
  });
}

function invalidateChatMessagesForRoom(queryClient: QueryClient, roomId: string) {
  queryClient.invalidateQueries({
    queryKey: ["chat", "messages", roomId],
  });
}

function invalidateChatRoom(queryClient: QueryClient, roomId: string) {
  queryClient.invalidateQueries({
    queryKey: ["chat", "room", roomId],
  });
}

function invalidateAllChat(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: ["chat"],
  });
}

export function registerChatCrossTabSync(queryClient: QueryClient): () => void {
  if (!hasBroadcastChannel()) return () => {};

  const channel = new BroadcastChannel(CHANNEL_NAME);
  const onMessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== "object" || data == null) return;

    const msg = data as Partial<ChatSyncMessage>;
    if (msg.v !== 1) return;

    if (msg.type === "chat.invalidate.rooms") {
      invalidateChatRooms(queryClient);
      return;
    }

    if (msg.type === "chat.invalidate") {
      if (typeof msg.roomId === "string" && msg.roomId.length > 0) {
        invalidateChatRooms(queryClient);
        invalidateChatRoom(queryClient, msg.roomId);
        invalidateChatMessagesForRoom(queryClient, msg.roomId);
      } else {
        invalidateAllChat(queryClient);
      }
    }
  };

  channel.addEventListener("message", onMessage);

  return () => {
    channel.removeEventListener("message", onMessage);
    channel.close();
  };
}

