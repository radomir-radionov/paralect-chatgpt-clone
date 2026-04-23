"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { authKeys } from "./keys";
import { fetchProfile, type UserProfile } from "./profile-fetcher";

export type { UserProfile };
export { fetchProfile } from "./profile-fetcher";

export const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: authKeys.profile(userId),
    queryFn: () => fetchProfile(getSupabaseBrowserClient(), userId),
    enabled: Boolean(userId),
  });

export function useProfile(userId: string) {
  return useQuery(profileQueryOptions(userId));
}
