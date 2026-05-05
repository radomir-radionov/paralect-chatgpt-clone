"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@shared/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shared/components/ui/empty";
import { Skeleton } from "@shared/components/ui/skeleton";
import { useIntersectionTrigger } from "@shared/lib/dom/useIntersectionTrigger";
import { AI_MODELS } from "@shared/lib/ai/model-registry";
import { cn } from "@shared/lib/utils";

import { ChatHeader } from "@domains/chat/components/ChatHeader";
import { ChatInput } from "@domains/chat/components/ChatInput";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { useChatScroll } from "@domains/chat/hooks/useChatScroll";
import { useStreamAssistantReply } from "@domains/chat/mutations/useStreamAssistantReply";
import { useUpdateRoomModel } from "@domains/chat/mutations/useUpdateRoomModel";
import { useRoom } from "@domains/chat/queries/useRooms";
import { useMessages } from "@domains/chat/queries/useMessages";
import { useProfile } from "@domains/auth/queries/useProfile";
import type { CachedMessage } from "@domains/chat/types/chat.types";

const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

function isGrouped(
  message: CachedMessage,
  prev: CachedMessage | undefined,
): boolean {
  if (!prev) return false;
  if (message.author_id !== prev.author_id) return false;
  const diff =
    new Date(message.created_at).getTime() -
    new Date(prev.created_at).getTime();
  return diff < GROUP_THRESHOLD_MS;
}

function RoomShellSkeleton() {
  return (
    <div
      className="flex h-full flex-col"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Loading chat…</span>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-[min(220px,60vw)]" />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-4">
        <Skeleton className="h-16 w-[min(100%,28rem)]" />
        <Skeleton className="ml-auto h-16 w-[min(100%,22rem)]" />
        <Skeleton className="h-20 w-[min(100%,26rem)]" />
      </div>
      <div className="shrink-0 border-t p-3">
        <Skeleton className="mx-auto h-12 w-full max-w-3xl" />
      </div>
    </div>
  );
}

function MessagesLoadingSkeleton() {
  return (
    <div
      className="space-y-4 px-2 py-2"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Loading messages…</span>
      <Skeleton className="h-16 w-[min(100%,28rem)]" />
      <Skeleton className="ml-auto h-16 w-[min(100%,22rem)]" />
      <Skeleton className="h-20 w-[min(100%,26rem)]" />
    </div>
  );
}

export function RoomClient({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  const roomQuery = useRoom(roomId, userId);
  const profileQuery = useProfile(userId);
  const updateRoomModelMutation = useUpdateRoomModel(userId);
  const streamAssistantReply = useStreamAssistantReply();
  const streamedForUserMessageIdsRef = useRef(new Set<string>());

  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
    status,
    refetch: refetchMessages,
  } = useMessages(roomId);

  const {
    scrollContainerRef,
    messagesEndRef,
    showScrollButton,
    handleScroll,
    scrollToBottom,
    startPreserveScrollOnOlderLoad,
    finishPreserveScrollOnOlderLoad,
  } = useChatScroll(messages.length);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role !== "user") return;
    if (streamAssistantReply.isPending) return;

    if (streamedForUserMessageIdsRef.current.has(last.id)) return;
    streamedForUserMessageIdsRef.current.add(last.id);

    void (async () => {
      const result = await streamAssistantReply.mutateAsync({
        roomId,
        userMessageId: last.id,
        assistantId: crypto.randomUUID(),
        createdAt: last.created_at,
      });

      if (result.error) {
        toast.error(result.message);
      }
    })();
  }, [messages, roomId, streamAssistantReply]);

  useEffect(() => {
    if (isFetchingNextPage) {
      startPreserveScrollOnOlderLoad();
    } else {
      finishPreserveScrollOnOlderLoad();
    }
  }, [finishPreserveScrollOnOlderLoad, isFetchingNextPage, startPreserveScrollOnOlderLoad]);

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const topSentinelRef = useIntersectionTrigger(handleIntersect, {
    enabled: hasNextPage && !isFetchingNextPage && status !== "error",
  });

  const room = roomQuery.data ?? null;
  const profile = profileQuery.data ?? null;

  const [modelSlug, setModelSlug] = useState("");

  const roomOrProfileError = roomQuery.isError || profileQuery.isError;
  const roomOrProfileLoading =
    (roomQuery.isPending && room == null) ||
    (profileQuery.isPending && profile == null);

  if (roomOrProfileError) {
    return (
      <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-destructive">Could not load this chat.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {roomQuery.isError ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void roomQuery.refetch()}
            >
              Retry chat
            </Button>
          ) : null}
          {profileQuery.isError ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void profileQuery.refetch()}
            >
              Retry profile
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (roomOrProfileLoading || room == null || profile == null) {
    return <RoomShellSkeleton />;
  }

  const messagesInitialLoading =
    status === "pending" && messages.length === 0 && error == null;
  const showMessagesEmpty =
    status === "success" && messages.length === 0 && error == null;

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        right={
          <select
            value={modelSlug || room.modelSlug}
            onChange={async (e) => {
              const next = e.target.value;
              setModelSlug(next);

              const result = await updateRoomModelMutation.mutateAsync({
                roomId,
                modelSlug: next as (typeof AI_MODELS)[number]["slug"],
              });

              if (result.error) {
                toast.error(result.message ?? "Failed to update model");
                setModelSlug(room.modelSlug);
                return;
              }

              toast.success("Model updated");
            }}
            disabled={updateRoomModelMutation.isPending}
            className={cn(
              "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] duration-200",
              "focus-visible:ring-[3px]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "w-full max-w-[min(220px,55vw)] sm:w-[220px] sm:max-w-none",
            )}
            aria-label="AI model"
          >
            {AI_MODELS.map((model) => (
              <option key={model.slug} value={model.slug}>
                {model.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "var(--border) transparent",
          }}
        >
          <div className="py-2">
            <div ref={topSentinelRef} />

            {isFetchingNextPage ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Loading older messages…
              </p>
            ) : null}

            {error != null ? (
              <div className="py-4 text-center">
                <p className="text-sm text-destructive">
                  Error loading messages.
                </p>
                <Button
                  type="button"
                  onClick={() => void refetchMessages()}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {messagesInitialLoading ? <MessagesLoadingSkeleton /> : null}

            {showMessagesEmpty ? (
              <Empty className="min-h-48 border-0 bg-transparent py-8">
                <EmptyHeader>
                  <EmptyTitle>No messages yet</EmptyTitle>
                  <EmptyDescription>
                    Send a message below to start this conversation.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                roomId={roomId}
                {...message}
                isOwn={message.author_id === userId}
                isGrouped={isGrouped(message, messages[index - 1])}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {showScrollButton ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 motion-safe:transition-opacity motion-safe:duration-200">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full shadow-md"
              onClick={() => scrollToBottom("smooth")}
            >
              <ArrowDownIcon className="size-3.5" />
              Scroll to bottom
            </Button>
          </div>
        ) : null}
      </div>

      <ChatInput
        roomId={room.id}
        author={{
          id: profile.id,
          name: profile.name,
          image_url: profile.image_url,
        }}
      />
    </div>
  );
}
