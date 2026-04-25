"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { authKeys } from "@domains/auth/queries/keys";

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.setQueryData(authKeys.currentUser, null);
      await queryClient.cancelQueries({ queryKey: authKeys.all });
      queryClient.removeQueries({ queryKey: authKeys.all });
    },
  });
}
