import { dehydrate } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getMe } from "@domains/auth/api/getMe";
import { getJoinedRooms } from "@domains/chat/api/getJoinedRooms";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

import { chatKeys } from "@domains/chat/queries/keys";
import { ChatLayoutShell } from "@domains/chat/components/ChatLayoutShell";
import { ChatSidebar } from "@domains/chat/components/ChatSidebar";

export const dynamic = "force-dynamic";

export default async function RoomsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getMe();
  if (user == null) {
    return (
      <div className="flex h-svh min-h-0 w-full overflow-hidden supports-[height:100dvh]:h-dvh">
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: chatKeys.joinedRooms(user.id),
    queryFn: () => getJoinedRooms(),
  });

  return (
    <ChatLayoutShell
      sidebar={
        <HydrateClient state={dehydrate(queryClient)}>
          <ChatSidebar userId={user.id} />
        </HydrateClient>
      }
    >
      {children}
    </ChatLayoutShell>
  );
}
