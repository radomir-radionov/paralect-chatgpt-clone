import { notFound } from "next/navigation";
import { dehydrate } from "@tanstack/react-query";

import { fetchProfile } from "@domains/auth/queries/profile-fetcher";
import { authKeys } from "@domains/auth/queries/keys";
import { RoomClient } from "@domains/chat/components/RoomClient";
import { chatKeys } from "@domains/chat/queries/keys";
import {
  fetchMessagesPage,
  getNextPageParamForMessages,
  MESSAGES_INITIAL_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
} from "@domains/chat/queries/message-fetchers";
import { fetchRoom } from "@domains/chat/queries/room-fetchers";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (user == null) return notFound();

  const supabase = createSupabaseAdminClient();

  const [room, profile] = await Promise.all([
    fetchRoom(supabase, id, user.id),
    fetchProfile(supabase, user.id),
  ]);

  if (room == null || profile == null) return notFound();

  const queryClient = getQueryClient();

  queryClient.setQueryData(chatKeys.room(id), room);
  queryClient.setQueryData(authKeys.profile(user.id), profile);

  await queryClient.prefetchInfiniteQuery({
    queryKey: chatKeys.messages(id),
    queryFn: ({ pageParam }) =>
      fetchMessagesPage(
        supabase,
        id,
        pageParam,
        pageParam == null ? MESSAGES_INITIAL_PAGE_SIZE : MESSAGES_PAGE_SIZE,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: getNextPageParamForMessages,
  });

  return (
    <HydrateClient state={dehydrate(queryClient)}>
      <RoomClient roomId={id} userId={user.id} />
    </HydrateClient>
  );
}
