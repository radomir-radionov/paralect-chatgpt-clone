"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChatMessage } from "@/components/chat/chat-message";
import type {
  ChatThreadMessage,
  ChatThreadStatus,
} from "@/components/chat/chat-thread.types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ChatMessageListProps = {
  messages: ChatThreadMessage[];
  status: ChatThreadStatus;
  isInitialLoading: boolean;
  empty: boolean;
  canLoadOlder?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
};

const SCROLL_BOTTOM_THRESHOLD_PX = 96;

export function ChatMessageList({
  messages,
  status,
  isInitialLoading,
  empty,
  canLoadOlder = false,
  isLoadingOlder = false,
  onLoadOlder,
}: ChatMessageListProps) {
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  const latestMessageFingerprint = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    return `${lastMessage?.id ?? "none"}:${lastMessage?.content.length ?? 0}:${status}`;
  }, [messages, status]);

  useEffect(() => {
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    viewportRef.current = viewport ?? null;

    if (!viewport) return;

    const handleScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
      shouldStickToBottomRef.current =
        distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX;
    };

    handleScroll();
    viewport.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !shouldStickToBottomRef.current) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    const behavior =
      messages.length > previousMessageCountRef.current ? "smooth" : "auto";

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });

    previousMessageCountRef.current = messages.length;
  }, [latestMessageFingerprint, messages.length]);

  return (
    <ScrollArea ref={scrollRootRef} className="min-h-0 flex-1 px-4 py-4">
      {isInitialLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-[80%]" />
          <Skeleton className="ml-auto h-16 w-[70%]" />
        </div>
      ) : empty ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-24 text-center">
          <p className="text-lg font-medium text-foreground">Start a conversation</p>
          <p className="max-w-sm text-sm">
            Ask a question or paste an image. When not signed in, you can add
            .txt/.pdf from the toolbar as context; sign in to keep chats and a
            larger document library.
          </p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-8">
          {canLoadOlder && onLoadOlder && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={isLoadingOlder}
                onClick={onLoadOlder}
              >
                {isLoadingOlder ? "Loading older messages..." : "Load older messages"}
              </Button>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <ChatMessage message={message} />
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
