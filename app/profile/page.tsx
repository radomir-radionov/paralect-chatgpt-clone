import { redirect } from "next/navigation";
import { dehydrate } from "@tanstack/react-query";

import { getMe } from "@domains/auth/api/getMe";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";
import { getQueryClient } from "@shared/lib/query/getQueryClient";
import { HydrateClient } from "@shared/lib/query/HydrateClient";

import { ProfileView } from "@domains/auth/components/ProfileView";
import { authKeys } from "@domains/auth/queries/keys";

export default async function ProfilePage() {
  const origin = await getRequestOrigin();
  const user = await getMe({ origin });
  if (user == null) {
    redirect("/login");
  }

  const queryClient = getQueryClient();
  queryClient.setQueryData(authKeys.currentUser, user);

  return (
    <HydrateClient state={dehydrate(queryClient)}>
      <ProfileView />
    </HydrateClient>
  );
}
