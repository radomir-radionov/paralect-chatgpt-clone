import { getJoinedRooms } from "@domains/chat/api/getJoinedRooms";
import { ChatSidebarClient } from "@domains/chat/components/ChatSidebarClient";

type Props = {
  userId: string;
};

export async function ChatSidebar({ userId }: Props) {
  const rooms = await getJoinedRooms();

  return <ChatSidebarClient userId={userId} initialRooms={rooms} />;
}
