"use client";

import { useCallback } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@shared/components/ui/button";
import { useIntersectionTrigger } from "@shared/lib/dom/useIntersectionTrigger";

import { ChatInput } from "@domains/chat/components/ChatInput";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { InviteUserModal } from "@domains/chat/components/InviteUserModal";
import { LeaveRoomButton } from "@domains/chat/components/LeaveRoomButton";
import { useRealtimeChat } from "@domains/chat/hooks/useRealtimeChat";
import { useRoom } from "@domains/chat/queries/useRooms";
import { useMessages } from "@domains/chat/queries/useMessages";
import { useProfile } from "@domains/auth/queries/useProfile";

export function RoomClient({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  const router = useRouter();
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

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const triggerRef = useIntersectionTrigger(handleIntersect, {
    enabled: hasNextPage && !isFetchingNextPage && status !== "error",
  });

  const room = roomQuery.data;
  const profile = profileQuery.data;

  if (room == null || profile == null) {
    return null;
  }

  return (
    <div className="container mx-auto h-screen-with-header border border-y-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="flex min-w-0 flex-1 items-start gap-2 border-b">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0"
            aria-label="Go back"
            onClick={() => router.back()}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div className="min-w-0 pb-3">
            <h1 className="text-2xl font-bold">{room.name}</h1>
            <p className="text-muted-foreground text-sm">
              {connectedUsers} {connectedUsers === 1 ? "user" : "users"} online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      <div
        className="grow overflow-y-auto flex flex-col-reverse"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
      >
        <div>
          {isFetchingNextPage && (
            <p className="text-center text-sm text-muted-foreground py-2">
              Loading more messages...
            </p>
          )}
          {error != null && (
            <div className="text-center">
              <p className="text-sm text-destructive py-2">
                Error loading messages.
              </p>
              <Button onClick={() => fetchNextPage()} variant="outline">
                Retry
              </Button>
            </div>
          )}
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              {...message}
              ref={index === 0 && hasNextPage ? triggerRef : null}
            />
          ))}
        </div>
      </div>
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
