import { notFound } from "next/navigation";
import { dehydrate } from "@tanstack/react-query";

import { getMe } from "@domains/auth/api/getMe";
import { getMyProfile } from "@domains/auth/api/getMyProfile";
import { authKeys } from "@domains/auth/queries/keys";
import { getMessagesPage } from "@domains/chat/api/getMessagesPage";
import { getRoom } from "@domains/chat/api/getRoom";
import { RoomClient } from "@domains/chat/components/RoomClient";
import { chatKeys } from "@domains/chat/queries/keys";
import {
  getNextPageParamForMessages,
  MESSAGES_INITIAL_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
} from "@domains/chat/queries/message-pagination";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const origin = await getRequestOrigin();
  const user = await getMe({ origin });
  if (user == null) return notFound();

  const profile = await getMyProfile({ origin });
  if (profile == null) return notFound();

  const room = await getRoom(id, { origin });

  const queryClient = getQueryClient();
  queryClient.setQueryData(authKeys.profile(user.id), profile);

  if (room != null) {
    queryClient.setQueryData(chatKeys.room(id), room);

    // Brand-new rooms have `last_message_at` null until the first message is
    // persisted. Skipping SSR message prefetch avoids HydrationBoundary
    // replacing in-flight client optimistic messages with an empty server page.
    if (room.lastMessageAt != null) {
      await queryClient.prefetchInfiniteQuery({
        queryKey: chatKeys.messages(id),
        queryFn: async ({ pageParam }) => {
          const limit = pageParam == null ? MESSAGES_INITIAL_PAGE_SIZE : MESSAGES_PAGE_SIZE;
          const { items } = await getMessagesPage({
            roomId: id,
            cursor: pageParam,
            limit,
            origin,
          });
          return items;
        },
        initialPageParam: null as string | null,
        getNextPageParam: getNextPageParamForMessages,
      });
    }
  }

  return (
    <HydrateClient state={dehydrate(queryClient)}>
      <RoomClient key={id} roomId={id} userId={user.id} />
    </HydrateClient>
  );
}
