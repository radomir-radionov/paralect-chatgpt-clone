"use client";

import { useCallback, useMemo, useState } from "react";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { ChatSidebar } from "./ChatSidebar";
import type { AuthenticatedUser, Conversation, Message } from "./chat-types";

type ChatLayoutProps = {
  user: AuthenticatedUser;
};

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createConversation(): Conversation {
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    createdAt: Date.now(),
  };
}

function deriveTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return "New chat";
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

export function ChatLayout({ user }: ChatLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(() => [
    createConversation(),
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string>(
    () => conversations[0].id,
  );

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ??
      conversations[0],
    [conversations, activeConversationId],
  );

  const handleNewChat = useCallback(() => {
    const next = createConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveConversationId(next.id);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const handleSendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        return;
      }

      const userMessage: Message = {
        id: createId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      const assistantMessage: Message = {
        id: createId(),
        role: "assistant",
        content:
          "This is a UI-only preview — connect an AI provider to generate real responses.",
        createdAt: Date.now() + 1,
      };

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== activeConversationId) {
            return conversation;
          }
          const isFirstMessage = conversation.messages.length === 0;
          return {
            ...conversation,
            title: isFirstMessage ? deriveTitle(trimmed) : conversation.title,
            messages: [...conversation.messages, userMessage, assistantMessage],
          };
        }),
      );
    },
    [activeConversationId],
  );

  return (
    <div className="flex h-screen w-full bg-[#0b0f19] text-slate-100">
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversation.id}
        user={user}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatMessages conversation={activeConversation} />
        <ChatInput onSend={handleSendMessage} />
      </main>
    </div>
  );
}
