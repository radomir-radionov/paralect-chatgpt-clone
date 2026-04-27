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
} from "@domains/chat/queries/message-fetchers";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const origin = await getRequestOrigin();
  const user = await getMe({ origin });
  if (user == null) return notFound();

  const [room, profile] = await Promise.all([
    getRoom(id, { origin }),
    getMyProfile({ origin }),
  ]);

  if (room == null || profile == null) return notFound();

  const queryClient = getQueryClient();

  queryClient.setQueryData(chatKeys.room(id), room);
  queryClient.setQueryData(authKeys.profile(user.id), profile);

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

  return (
    <HydrateClient state={dehydrate(queryClient)}>
      <RoomClient roomId={id} userId={user.id} />
    </HydrateClient>
  );
}
