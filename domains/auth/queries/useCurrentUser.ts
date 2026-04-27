"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { authKeys } from "./keys";
import { clientGetMe } from "./clientAuthFetchers";

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.currentUser,
    queryFn: async (): Promise<User | null> => clientGetMe(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

export function useCurrentUser() {
  const query = useQuery(currentUserQueryOptions());

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
  };
}
