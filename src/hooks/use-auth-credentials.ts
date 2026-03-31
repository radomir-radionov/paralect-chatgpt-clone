"use client";

import type { User } from "@supabase/supabase-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { authMeQueryKey } from "@/lib/auth-query";
import type { ChatSummary } from "@/lib/chat-api";

export type AuthMode = "signin" | "signup";

export type Credentials = {
  email: string;
  password: string;
};

export type AuthCredentialsVariables = {
  mode: AuthMode;
} & Credentials;

export function useAuthCredentials() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      mode: m,
      email,
      password,
    }: AuthCredentialsVariables) => {
      const path = m === "signup" ? "/api/auth/signup" : "/api/auth/login";
      return apiJson<{ user?: User }>(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    onSuccess: async (data) => {
      if (data.user) {
        queryClient.setQueryData(authMeQueryKey, data.user);
      }
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      await queryClient.prefetchQuery({
        queryKey: ["chats"],
        queryFn: () => apiJson<{ chats: ChatSummary[] }>("/api/chats"),
      });
      router.push("/chat");
      router.refresh();
    },
  });
}
