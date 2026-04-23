"use client";

import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { authKeys } from "./keys";

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.currentUser,
    queryFn: async (): Promise<User | null> => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

export function useCurrentUser() {
  const queryClient = useQueryClient();
  const query = useQuery(currentUserQueryOptions());

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData<User | null>(
        authKeys.currentUser,
        session?.user ?? null,
      );
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
  };
}
