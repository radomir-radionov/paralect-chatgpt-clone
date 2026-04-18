"use client";

import { useMutation } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

type SignInWithGoogleInput = {
  redirectTo?: string;
};

export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: async ({ redirectTo }: SignInWithGoogleInput = {}) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });
      if (error) throw error;
    },
  });
}
