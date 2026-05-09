import { ChatSidebarClient } from "@domains/chat/room/components/ChatSidebarClient";
import type { RoomListItem } from "@domains/chat/room/queries/room-fetchers";

type Props = {
  userId: string;
  initialRooms: RoomListItem[];
};

export function ChatSidebar({ userId, initialRooms }: Props) {
  return <ChatSidebarClient userId={userId} initialRooms={initialRooms} />;
}
