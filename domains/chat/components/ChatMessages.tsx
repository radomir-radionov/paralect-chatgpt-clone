"use client";

import { useEffect, useRef } from "react";
import type { Conversation, Message } from "@domains/chat/types/chat.types";

type ChatMessagesProps = {
  conversation: Conversation;
};

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-900/20"
            : "bg-white/[0.06] text-slate-100 ring-1 ring-white/5"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

export function ChatMessages({ conversation }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [conversation.messages.length]);

  if (conversation.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
            Paralect Chat
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Start a new conversation
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Type a message below to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 md:px-6">
        {conversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}
