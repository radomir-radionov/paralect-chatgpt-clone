import { notFound } from "next/navigation";
import { dehydrate } from "@tanstack/react-query";

import { getMe } from "@domains/auth/api/getMe";
import { getMyProfile } from "@domains/auth/api/getMyProfile";
import { authKeys } from "@domains/auth/queries/keys";
import { fetchRoomMessagesPageDirect } from "@domains/chat/room/api/getMessagesPage";
import { getRoom } from "@domains/chat/room/api/getRoom";
import { RoomClient } from "@domains/chat/room/components/RoomClient";
import { chatKeys } from "@domains/chat/room/queries/keys";
import {
  getNextPageParamForMessages,
  MESSAGES_INITIAL_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
} from "@domains/chat/room/queries/message-pagination";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getMe();
  if (user == null) return notFound();

  const [profile, room] = await Promise.all([getMyProfile(), getRoom(id)]);

  if (profile == null) return notFound();

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
          const limit =
            pageParam == null ? MESSAGES_INITIAL_PAGE_SIZE : MESSAGES_PAGE_SIZE;
          return fetchRoomMessagesPageDirect({
            roomId: id,
            cursor: pageParam,
            limit,
          });
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
