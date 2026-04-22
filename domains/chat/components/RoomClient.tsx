"use client";

import { useCallback, useEffect } from "react";
import { ArrowDownIcon } from "lucide-react";

import { Button } from "@shared/components/ui/button";
import { useIntersectionTrigger } from "@shared/lib/dom/useIntersectionTrigger";

import { ChatInput } from "@domains/chat/components/ChatInput";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { InviteUserModal } from "@domains/chat/components/InviteUserModal";
import { LeaveRoomButton } from "@domains/chat/components/LeaveRoomButton";
import { useChatScroll } from "@domains/chat/hooks/useChatScroll";
import { useRealtimeChat } from "@domains/chat/hooks/useRealtimeChat";
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

export function RoomClient({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  const roomQuery = useRoom(roomId, userId);
  const profileQuery = useProfile(userId);

  const { connectedUsers, broadcastMessage } = useRealtimeChat({
    roomId,
    userId,
  });

  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
    status,
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

  // Preserve scroll position when loading older messages
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

  const room = roomQuery.data;
  const profile = profileQuery.data;

  if (room == null || profile == null) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0">
        <div className="min-w-0">
          <h1 className="text-base font-semibold truncate">{room.name}</h1>
          <p className="text-xs text-muted-foreground">
            {connectedUsers} {connectedUsers === 1 ? "user" : "users"} online
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InviteUserModal roomId={room.id} />
          <LeaveRoomButton
            roomId={room.id}
            redirectTo="/"
            size="sm"
            variant="destructive"
          >
            Leave
          </LeaveRoomButton>
        </div>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0">
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
            {/* Top sentinel for load-more */}
            <div ref={topSentinelRef} />

            {isFetchingNextPage && (
              <p className="text-center text-xs text-muted-foreground py-3">
                Loading older messages…
              </p>
            )}

            {error != null && (
              <div className="text-center py-4">
                <p className="text-sm text-destructive">
                  Error loading messages.
                </p>
                <Button
                  onClick={() => fetchNextPage()}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                {...message}
                isOwn={message.author_id === userId}
                isGrouped={isGrouped(message, messages[index - 1])}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll to bottom FAB */}
        {showScrollButton && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full shadow-md gap-1.5"
              onClick={() => scrollToBottom("smooth")}
            >
              <ArrowDownIcon className="size-3.5" />
              Scroll to bottom
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        roomId={room.id}
        author={{
          id: profile.id,
          name: profile.name,
          image_url: profile.image_url,
        }}
        onSuccessfulSend={broadcastMessage}
      />
    </div>
  );
}
