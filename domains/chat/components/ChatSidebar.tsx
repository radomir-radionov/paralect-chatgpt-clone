import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

import { fetchJoinedRooms } from "@domains/chat/queries/room-fetchers";
import { ChatSidebarClient } from "@domains/chat/components/ChatSidebarClient";

type Props = {
  userId: string;
};

export async function ChatSidebar({ userId }: Props) {
  const supabase = createSupabaseAdminClient();
  const rooms = await fetchJoinedRooms(supabase, userId);

  return <ChatSidebarClient userId={userId} initialRooms={rooms} />;
}
