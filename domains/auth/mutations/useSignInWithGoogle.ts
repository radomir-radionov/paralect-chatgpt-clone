"use client";

import { useMutation } from "@tanstack/react-query";

type SignInWithGoogleInput = {
  redirectTo?: string;
};

export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: async ({ redirectTo }: SignInWithGoogleInput = {}) => {
      const res = await fetch("/api/auth/sign-in-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirectTo: redirectTo ?? `${window.location.origin}/`,
        }),
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
          : "Google sign-in failed";
      if (!res.ok || (json as { error?: boolean } | null)?.error === true) {
        throw new Error(message);
      }
      const url = (json as { url?: string }).url;
      if (typeof url !== "string" || !url) {
        throw new Error("Could not start Google sign-in");
      }
      window.location.assign(url);
    },
  });
}
