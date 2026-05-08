"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authKeys } from "@domains/auth/queries/keys";
import type { SignUpInput } from "@domains/auth/schemas/auth";

export type SignUpResult = {
  isNewRegistration: boolean;
  hasSession: boolean;
};

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation<SignUpResult, Error, SignUpInput>({
    mutationFn: async ({ email, password }) => {
      const res = await fetch("/api/auth/sign-up", {
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
          : "Sign-up failed";
      if (!res.ok || (json as { error?: boolean } | null)?.error === true) {
        throw new Error(message);
      }

      const payload = json as {
        isNewRegistration?: boolean;
        hasSession?: boolean;
      };
      return {
        isNewRegistration: Boolean(payload.isNewRegistration),
        hasSession: Boolean(payload.hasSession),
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.currentUser });
      await queryClient.invalidateQueries({ queryKey: authKeys.myProfile });
    },
  });
}
