"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { authKeys } from "./keys";
import { clientGetProfile } from "./clientAuthFetchers";
import type { UserProfile } from "./profile-fetcher";

export type { UserProfile };

export const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: authKeys.profile(userId),
    queryFn: () => clientGetProfile(),
    enabled: Boolean(userId),
    refetchOnWindowFocus: false,
    retryOnMount: false,
    staleTime: 30_000,
  });

export function useProfile(userId: string) {
  return useQuery(profileQueryOptions(userId));
}
