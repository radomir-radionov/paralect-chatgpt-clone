"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { authKeys } from "@domains/auth/queries/keys";

type SignUpInput = {
  email: string;
  password: string;
  emailRedirectTo?: string;
};

export type SignUpResult = {
  isNewRegistration: boolean;
};

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation<SignUpResult, Error, SignUpInput>({
    mutationFn: async ({ email, password, emailRedirectTo }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });

      if (error) throw error;

      const identities = data.user?.identities;
      const isNewRegistration = identities != null && identities.length > 0;
      return { isNewRegistration };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.currentUser });
    },
  });
}
