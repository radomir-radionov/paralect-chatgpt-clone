"use client";

import { useMemo } from "react";
import { useAuthUser } from "@/hooks/use-auth";
import { resolveChatSessionState } from "@/lib/chat-session";

export function useChatSession() {
  const { user, isLoading: authLoading } = useAuthUser();

  return useMemo(
    () =>
      resolveChatSessionState({
        user,
        authLoading,
      }),
    [user, authLoading],
  );
}
