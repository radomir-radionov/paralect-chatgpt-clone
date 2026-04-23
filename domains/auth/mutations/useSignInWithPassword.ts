"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { authKeys } from "@domains/auth/queries/keys";

type SignInInput = {
  email: string;
  password: string;
};

export function useSignInWithPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: SignInInput) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.currentUser });
    },
  });
}
