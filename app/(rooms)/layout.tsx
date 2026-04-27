import { dehydrate } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getMe } from "@domains/auth/api/getMe";
import { getJoinedRooms } from "@domains/chat/api/getJoinedRooms";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

import { chatKeys } from "@domains/chat/queries/keys";
import { ChatSidebar } from "@domains/chat/components/ChatSidebar";

export default async function RoomsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getMe();
  if (user == null) {
    return (
      <div className="flex h-screen overflow-hidden">
        <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
      </div>
    );
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: chatKeys.joinedRooms(user.id),
    queryFn: () => getJoinedRooms(),
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <HydrateClient state={dehydrate(queryClient)}>
        <ChatSidebar userId={user.id} />
      </HydrateClient>
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
