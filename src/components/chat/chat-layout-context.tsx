"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRealtimeChats } from "@/hooks/use-realtime-chats";
import { useChatSession } from "@/hooks/use-chat-session";
import type { ChatSessionState } from "@/lib/chat-session";

type ChatLayoutContextValue = {
  session: ChatSessionState;
  routingChatId: string | undefined;
  setRoutingChatId: (id: string | undefined) => void;
};

const ChatLayoutContext = createContext<ChatLayoutContextValue | null>(null);

export function ChatLayoutProvider({ children }: { children: ReactNode }) {
  const session = useChatSession();
  useRealtimeChats(session.role === "user" ? session.user.id : undefined);
  const [routingChatId, setRoutingChatId] = useState<string | undefined>();

  const value = useMemo(
    () => ({
      session,
      routingChatId,
      setRoutingChatId,
    }),
    [session, routingChatId],
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
