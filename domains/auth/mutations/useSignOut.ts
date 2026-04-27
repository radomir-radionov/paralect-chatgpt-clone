"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "@domains/auth/queries/keys";

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        // ignore
      }
      const message =
        typeof (json as { message?: string } | null)?.message === "string"
          ? (json as { message: string }).message
          : "Sign-out failed";
      if (!res.ok || (json as { error?: boolean } | null)?.error === true) {
        throw new Error(message);
      }
    },
    onSuccess: async () => {
      queryClient.setQueryData(authKeys.currentUser, null);
      await queryClient.cancelQueries({ queryKey: authKeys.all });
      queryClient.removeQueries({ queryKey: authKeys.all });
    },
  });
}
