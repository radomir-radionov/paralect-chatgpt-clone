"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LogOutIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";

import { ActionButton } from "@shared/components/ui/action-button";
import { Button } from "@shared/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shared/components/ui/empty";
import { AiKnotMark } from "@shared/assets/AiKnotMark";
import { Skeleton } from "@shared/components/ui/skeleton";
import { cn } from "@shared/lib/utils";

import { SignOutButton } from "@domains/auth/components/SignOutButton";
import { useRoomsNavOptional } from "@domains/chat/room/context/RoomsNavContext";
import { useChatSidebarRooms } from "@domains/chat/room/hooks/useChatSidebarRooms";
import { useCloseMobileSidebarOnRouteChange } from "@domains/chat/room/hooks/useCloseMobileSidebarOnRouteChange";
import { useRoomNavPrefetch } from "@domains/chat/room/hooks/useRoomNavPrefetch";
import type { RoomListItem } from "@domains/chat/room/queries/useRooms";

type Props = {
  userId: string;
  initialRooms: RoomListItem[];
};

export function ChatSidebarClient({ userId, initialRooms }: Props) {
  const params = useParams();
  const roomsNav = useRoomsNavOptional();
  const closeMobileSidebar = roomsNav?.closeMobileSidebar;
  const activeRoomId = typeof params?.id === "string" ? params.id : undefined;

  useCloseMobileSidebarOnRouteChange(closeMobileSidebar);

  const {
    optimisticRooms,
    showRoomsPlaceholder,
    deleteRoomMutation,
    deleteRoom,
  } = useChatSidebarRooms({ userId, initialRooms, activeRoomId });

  const { navRef, scheduleRoomPrefetch } = useRoomNavPrefetch({
    activeRoomId,
    rooms: optimisticRooms,
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <Link
          href="/"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="AI Chat"
          title="AI Chat"
        >
          <AiKnotMark className="size-6" />
        </Link>
        {roomsNav != null ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 md:hidden"
            onClick={roomsNav.closeMobileSidebar}
            aria-label="Close sidebar"
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>

      <nav
        ref={navRef}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        <Link
          href="/"
          aria-label="New chat"
          title="New chat"
          style={{ cursor: "pointer" }}
          className={cn(
            "block min-w-0 rounded-md px-3 py-2 text-sm transition-colors duration-200",
            "cursor-pointer text-muted-foreground",
            "hover:bg-accent hover:text-accent-foreground",
            "inline-flex items-center gap-1.5",
          )}
        >
          <PlusIcon className="size-4" />
          New chat
        </Link>

        {showRoomsPlaceholder ? (
          <div
            className="flex flex-col gap-1.5 p-1"
            aria-busy="true"
            role="status"
          >
            <span className="sr-only">Loading chats…</span>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : optimisticRooms.length === 0 ? (
          <Empty className="min-h-0 flex-none gap-3 rounded-none border-0 bg-transparent p-4 py-8">
            <EmptyHeader className="gap-1">
              <EmptyTitle className="text-sm">No chats yet</EmptyTitle>
              <EmptyDescription className="text-xs">
                <Link href="/">Start one</Link>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          optimisticRooms.map((room) => {
            const roomHref = `/rooms/${room.id}`;

            return (
              <div
                key={room.id}
                className="group relative cursor-pointer"
                data-prefetch-room={room.id}
              >
                <Link
                  href={roomHref}
                  prefetch={activeRoomId !== room.id}
                  onFocus={() => {
                    scheduleRoomPrefetch(room.id);
                  }}
                  className={cn(
                    "block min-w-0 rounded-md px-3 py-2 pr-8 text-sm transition-colors duration-200",
                    "cursor-pointer",
                    "hover:bg-accent hover:text-accent-foreground",
                    activeRoomId === room.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="block truncate">{room.name}</span>
                </Link>

                <ActionButton
                  variant="ghost"
                  size="icon-sm"
                  title="Delete chat"
                  requireAreYouSure
                  areYouSureDescription="This will permanently delete this chat and all of its messages."
                  className={cn(
                    "absolute right-1.5 top-1/2 -translate-y-1/2",
                    "z-10",
                    "motion-safe:transition-opacity motion-safe:duration-200",
                    "pointer-coarse:opacity-100",
                    "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100",
                    "focus-visible:opacity-100",
                    "text-destructive hover:text-destructive hover:bg-destructive/10",
                  )}
                  disabled={
                    deleteRoomMutation.isPending &&
                    deleteRoomMutation.variables?.roomId === room.id
                  }
                  action={() => deleteRoom(room.id)}
                >
                  <Trash2Icon className="size-4" />
                </ActionButton>
              </div>
            );
          })
        )}
      </nav>

      <div className="border-t p-2 flex items-center justify-end">
        <SignOutButton
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          title="Sign out"
        >
          <LogOutIcon className="size-4" />
        </SignOutButton>
      </div>
    </div>
  );
}
