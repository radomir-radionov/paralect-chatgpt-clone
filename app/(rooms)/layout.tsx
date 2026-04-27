import { dehydrate } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

import { chatKeys } from "@domains/chat/queries/keys";
import { fetchJoinedRooms } from "@domains/chat/queries/room-fetchers";
import { ChatSidebar } from "@domains/chat/components/ChatSidebar";

export default async function RoomsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (user == null) {
    return (
      <div className="flex h-screen overflow-hidden">
        <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
      </div>
    );
  }

  const queryClient = getQueryClient();
  const supabase = createSupabaseAdminClient();

  await queryClient.prefetchQuery({
    queryKey: chatKeys.joinedRooms(user.id),
    queryFn: () => fetchJoinedRooms(supabase, user.id),
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
