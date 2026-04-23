"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@shared/components/ui/button";
import { ActionButton } from "@shared/components/ui/action-button";
import { useIntersectionTrigger } from "@shared/lib/dom/useIntersectionTrigger";
import { AI_MODELS, getAiModelBySlug } from "@shared/lib/ai/model-registry";
import { cn } from "@shared/lib/utils";

import { ChatInput } from "@domains/chat/components/ChatInput";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { useChatScroll } from "@domains/chat/hooks/useChatScroll";
import { useDeleteRoom } from "@domains/chat/mutations/useDeleteRoom";
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
  const deleteRoomMutation = useDeleteRoom(userId);
  const updateRoomModelMutation = useUpdateRoomModel(userId);

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
  const selectedModel = useMemo(
    () => (room ? getAiModelBySlug(room.modelSlug) : null),
    [room],
  );
  const [modelSlug, setModelSlug] = useState(() => room?.modelSlug ?? "");

  if (room == null || profile == null) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-base font-semibold truncate">{room.name}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {selectedModel?.label ?? room.modelSlug}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-muted-foreground hidden sm:block">
            Model
          </label>
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
                setModelSlug("");
                return;
              }

              toast.success("Model updated");
            }}
            disabled={updateRoomModelMutation.isPending}
            className={cn(
              "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow]",
              "focus-visible:ring-[3px]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "w-[220px] max-w-[60vw]",
            )}
            aria-label="AI model"
          >
            {AI_MODELS.map((model) => (
              <option key={model.slug} value={model.slug}>
                {model.label}
              </option>
            ))}
          </select>

          <ActionButton
            variant="ghost"
            size="icon-sm"
            title="Delete chat"
            requireAreYouSure
            areYouSureDescription="This will permanently delete this chat and all of its messages."
            action={async () => {
              const result = await deleteRoomMutation.mutateAsync({ roomId });
              if (result.error) return result;

              toast.success("Chat deleted");
              router.push("/");
              return { error: false };
            }}
          >
            <Trash2Icon className="size-4" />
          </ActionButton>
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
      />
    </div>
  );
}
