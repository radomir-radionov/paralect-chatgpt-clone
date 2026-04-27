"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "@domains/auth/queries/keys";

type SignInInput = {
  email: string;
  password: string;
};

export function useSignInWithPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: SignInInput) => {
      const res = await fetch("/api/auth/sign-in-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        // ignore
      }
      const message =
        typeof (json as { message?: string } | null)?.message === "string"
          ? (json as { message: string }).message
          : "Sign-in failed";
      if (!res.ok || (json as { error?: boolean } | null)?.error === true) {
        throw new Error(message);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.currentUser });
    },
  });
}
