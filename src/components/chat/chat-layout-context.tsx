"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRecoverAuthHash } from "@/hooks/use-recover-auth-hash";
import { useRealtimeChats } from "@/hooks/use-realtime-chats";
import { useAuthUser } from "@/hooks/use-auth";

type ChatLayoutContextValue = {
  user: User | null;
  authLoading: boolean;
  refetchAuth: () => Promise<void>;
  routingChatId: string | undefined;
  setRoutingChatId: (id: string | undefined) => void;
};

const ChatLayoutContext = createContext<ChatLayoutContextValue | null>(null);

export function ChatLayoutProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, refetch: refetchAuth } = useAuthUser();
  useRecoverAuthHash(refetchAuth);
  useRealtimeChats(user?.id);
  const [routingChatId, setRoutingChatId] = useState<string | undefined>();

  const value = useMemo(
    () => ({
      user: user ?? null,
      authLoading,
      refetchAuth,
      routingChatId,
      setRoutingChatId,
    }),
    [user, authLoading, refetchAuth, routingChatId],
  );

  return (
    <ChatLayoutContext.Provider value={value}>
      {children}
    </ChatLayoutContext.Provider>
  );
}

export function useChatLayout() {
  const ctx = useContext(ChatLayoutContext);
  if (!ctx) {
    throw new Error("useChatLayout must be used within ChatLayoutProvider");
  }
  return ctx;
}
