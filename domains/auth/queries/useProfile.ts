"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { authKeys } from "./keys";
import { clientGetProfile } from "./clientAuthFetchers";
import type { UserProfile } from "./profile-fetcher";

export type { UserProfile };
export { fetchProfile } from "./profile-fetcher";

export const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: authKeys.profile(userId),
    queryFn: () => clientGetProfile(),
    enabled: Boolean(userId),
  });

export function useProfile(userId: string) {
  return useQuery(profileQueryOptions(userId));
}
