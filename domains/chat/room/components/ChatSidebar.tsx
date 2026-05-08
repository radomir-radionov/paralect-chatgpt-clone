import { getJoinedRooms } from "@domains/chat/room/api/getJoinedRooms";
import { ChatSidebarClient } from "@domains/chat/room/components/ChatSidebarClient";

type Props = {
  userId: string;
};

export async function ChatSidebar({ userId }: Props) {
  const rooms = await getJoinedRooms();

  return <ChatSidebarClient userId={userId} initialRooms={rooms} />;
}
