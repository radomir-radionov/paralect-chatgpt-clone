import { redirect } from "next/navigation";
import { dehydrate } from "@tanstack/react-query";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

import { AppAuthBar } from "@domains/auth/components/AppAuthBar";
import { RoomsList } from "@domains/chat/components/RoomsList";
import { chatKeys } from "@domains/chat/queries/keys";
import {
  fetchJoinedRooms,
  fetchPublicRooms,
} from "@domains/chat/queries/room-fetchers";

export default async function Home() {
  const user = await getCurrentUser();
  if (user == null) {
    redirect("/login");
  }

  const queryClient = getQueryClient();
  const supabase = createSupabaseAdminClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: chatKeys.publicRooms,
      queryFn: () => fetchPublicRooms(supabase),
    }),
    queryClient.prefetchQuery({
      queryKey: chatKeys.joinedRooms(user.id),
      queryFn: () => fetchJoinedRooms(supabase, user.id),
    }),
  ]);

  return (
    <div className="min-h-screen">
      <AppAuthBar />
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
        <HydrateClient state={dehydrate(queryClient)}>
          <RoomsList userId={user.id} />
        </HydrateClient>
      </div>
    </div>
  );
}
