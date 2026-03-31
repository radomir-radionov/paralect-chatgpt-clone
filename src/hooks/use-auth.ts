"use client";

import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { authMeQueryKey, fetchAuthMe } from "@/lib/auth-query";

export function useAuthUser() {
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: fetchAuthMe,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const user: User | null = data ?? null;
  /** True only until the first auth resolution completes (initial shell / layout). */
  const isLoading = isPending;
  return {
    user,
    isLoading,
    /** True during any in-flight /api/auth/me request (refetches do not flash the main skeleton). */
    isFetching,
    refetch,
  };
}
