"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authMeQueryKey } from "@/lib/auth-query";

export function useSignOutMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Logout failed (${res.status})`);
      }
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["chats"] });
      queryClient.setQueryData(authMeQueryKey, null);
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      router.replace("/chat");
      router.refresh();
    },
  });
}
