"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowDownIcon } from "lucide-react";

import { Button } from "@shared/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shared/components/ui/empty";
import { Skeleton } from "@shared/components/ui/skeleton";
import { useIntersectionTrigger } from "@shared/lib/dom/useIntersectionTrigger";
import type { AiModelSlug } from "@shared/lib/ai/model-registry";
import { cn } from "@shared/lib/utils";

import { ChatHeader } from "@domains/chat/room/components/ChatHeader";
import { ChatInput } from "@domains/chat/room/components/ChatInput";
import { ChatMessage } from "@domains/chat/room/components/ChatMessage";
import { AiModelSelect } from "@domains/chat/room/components/AiModelSelect";
import { useAutoStreamAssistantReply } from "@domains/chat/streaming/hooks/useAutoStreamAssistantReply";
import { useChatScroll } from "@domains/chat/room/hooks/useChatScroll";
import { useRoomModelPreference } from "@domains/chat/room/hooks/useRoomModelPreference";
import { useRoomStreamInFlightCount } from "@domains/chat/streaming/hooks/useRoomStreamInFlightCount";
import { useStreamAssistantReply } from "@domains/chat/streaming/mutations/useStreamAssistantReply";
import { useRoom } from "@domains/chat/room/queries/useRooms";
import { useMessages } from "@domains/chat/room/queries/useMessages";
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

function ChatLoadingSkeleton({ variant }: { variant: "full" | "messages" }) {
  const bubbles = (
    <>
      <span className="sr-only">
        {variant === "full" ? "Loading chat…" : "Loading messages…"}
      </span>
      <Skeleton className="h-16 w-[min(100%,28rem)]" />
      <Skeleton className="ml-auto h-16 w-[min(100%,22rem)]" />
      <Skeleton className="h-20 w-[min(100%,26rem)]" />
    </>
  );

  if (variant === "messages") {
    return (
      <div className="space-y-4 px-2 py-2" aria-busy="true" role="status">
        {bubbles}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 space-y-4 overflow-hidden p-4"
        aria-busy="true"
        role="status"
      >
        {bubbles}
      </div>
      <div className="shrink-0 border-t p-3">
        <Skeleton className="mx-auto h-12 w-full max-w-3xl" />
      </div>
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
  const roomSendStreamInFlight = useRoomStreamInFlightCount(roomId);
  const roomQuery = useRoom(roomId, userId);
  const profileQuery = useProfile(userId);
  const streamAssistantReply = useStreamAssistantReply();

  const serverModelSlug = roomQuery.data?.modelSlug as AiModelSlug | undefined;
  const { uiSlug, streamSlug, setModelSlug } = useRoomModelPreference(
    roomId,
    serverModelSlug,
  );

  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
    status,
    refetch: refetchMessages,
  } = useMessages(roomId, {
    // Pause refetch while the initial send stream runs so optimistic rows are not wiped.
    enabled: roomSendStreamInFlight === 0,
  });

  useAutoStreamAssistantReply({
    roomId,
    messages,
    modelSlug: streamSlug,
    roomSendStreamInFlight,
    streamAssistantReply,
  });

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
    if (isFetchingNextPage) {
      startPreserveScrollOnOlderLoad();
    } else {
      finishPreserveScrollOnOlderLoad();
    }
  }, [
    finishPreserveScrollOnOlderLoad,
    isFetchingNextPage,
    startPreserveScrollOnOlderLoad,
  ]);

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const topSentinelRef = useIntersectionTrigger(handleIntersect, {
    enabled: hasNextPage && !isFetchingNextPage && status !== "error",
  });

  const headerModelSelectClassName = cn(
    "transition-[color,box-shadow] duration-200",
    "w-full max-w-[min(220px,55vw)] sm:w-[220px] sm:max-w-none",
  );

  const headerModelSelect = useMemo(
    () => (
      <AiModelSelect
        value={uiSlug}
        onChange={setModelSlug}
        className={headerModelSelectClassName}
      />
    ),
    [headerModelSelectClassName, setModelSlug, uiSlug],
  );

  const room = roomQuery.data ?? null;
  const profile = profileQuery.data ?? null;

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
    return (
      <div className="flex h-full flex-col">
        <ChatHeader right={headerModelSelect} />
        <ChatLoadingSkeleton variant="full" />
      </div>
    );
  }

  const messagesInitialLoading =
    status === "pending" && messages.length === 0 && error == null;
  const showMessagesEmpty =
    status === "success" && messages.length === 0 && error == null;

  const shouldRenderThinkingPlaceholder =
    roomSendStreamInFlight > 0 &&
    !messages.some((m) => m.role === "assistant" && m.status === "pending");

  return (
    <div className="flex h-full flex-col">
      <ChatHeader right={headerModelSelect} />

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

            {messagesInitialLoading ? (
              <ChatLoadingSkeleton variant="messages" />
            ) : null}

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

            {shouldRenderThinkingPlaceholder ? (
              <ChatMessage
                key="__thinking__"
                roomId={roomId}
                id="__thinking__"
                text=""
                created_at={
                  messages[messages.length - 1]?.created_at ??
                  new Date().toISOString()
                }
                author_id={null}
                role="assistant"
                author={{ name: "Assistant", image_url: null }}
                isOwn={false}
                status="pending"
              />
            ) : null}

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
        modelSlugOverride={uiSlug}
      />
    </div>
  );
}
