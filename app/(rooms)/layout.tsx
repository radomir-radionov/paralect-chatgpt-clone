import { dehydrate } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getMe } from "@domains/auth/api/getMe";
import { getJoinedRooms } from "@domains/chat/room/api/getJoinedRooms";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

import { chatKeys } from "@domains/chat/room/queries/keys";
import { ChatLayoutShell } from "@domains/chat/room/components/ChatLayoutShell";
import { ChatSidebar } from "@domains/chat/room/components/ChatSidebar";

export default async function RoomsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getMe();
  if (user == null) {
    return (
      <div className="flex h-svh min-h-0 w-full overflow-hidden supports-[height:100dvh]:h-dvh">
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  const rooms = await getJoinedRooms();
  const queryClient = getQueryClient();
  queryClient.setQueryData(chatKeys.joinedRooms(user.id), rooms);

  return (
    <ChatLayoutShell
      sidebar={
        <HydrateClient state={dehydrate(queryClient)}>
          <ChatSidebar userId={user.id} initialRooms={rooms} />
        </HydrateClient>
      }
    >
      {children}
    </ChatLayoutShell>
  );
}
