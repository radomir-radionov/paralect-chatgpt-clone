"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOutIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";

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
import { useRoomsNavOptional } from "@domains/chat/context/RoomsNavContext";
import { useDeleteRoom } from "@domains/chat/mutations/useDeleteRoom";
import type { RoomListItem } from "@domains/chat/queries/useRooms";
import { useJoinedRooms } from "@domains/chat/queries/useRooms";
import { chatKeys } from "@domains/chat/queries/keys";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  userId: string;
  initialRooms: RoomListItem[];
};

export function ChatSidebarClient({ userId, initialRooms }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const roomsNav = useRoomsNavOptional();
  const closeMobileSidebar = roomsNav?.closeMobileSidebar;
  const activeRoomId = typeof params?.id === "string" ? params.id : undefined;

  useEffect(() => {
    closeMobileSidebar?.();
  }, [pathname, closeMobileSidebar]);

  const queryClient = useQueryClient();
  const roomsQuery = useJoinedRooms(userId);
  const rooms = roomsQuery.data ?? initialRooms;
  const showRoomsPlaceholder =
    roomsQuery.isPending && roomsQuery.data === undefined;

  const deleteRoomMutation = useDeleteRoom(userId);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Link
          href="/"
          className="inline-flex items-center justify-center size-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="AI Chat"
          title="AI Chat"
        >
          <AiKnotMark className="size-6" />
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
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
        ) : rooms.length === 0 ? (
          <Empty className="min-h-0 flex-none gap-3 rounded-none border-0 bg-transparent p-4 py-8">
            <EmptyHeader className="gap-1">
              <EmptyTitle className="text-sm">No chats yet</EmptyTitle>
              <EmptyDescription className="text-xs">
                <Link href="/">Start one</Link>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          rooms.map((room) => {
            return (
              <div
                key={room.id}
                className={cn(
                  "group relative rounded-md px-3 py-2 text-sm transition-colors duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                  activeRoomId === room.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                <Link
                  href={`/rooms/${room.id}`}
                  className="block min-w-0 pr-8"
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
                    "[@media(pointer:coarse)]:opacity-100",
                    "[@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100",
                    "focus-visible:opacity-100",
                    "text-destructive hover:text-destructive hover:bg-destructive/10",
                  )}
                  disabled={deleteRoomMutation.isPending}
                  action={async () => {
                    const result = await deleteRoomMutation.mutateAsync({
                      roomId: room.id,
                    });
                    if (result.error) return result;

                    if (activeRoomId === room.id) {
                      router.replace("/");
                    }

                    await queryClient.cancelQueries({
                      queryKey: chatKeys.room(room.id),
                    });
                    await queryClient.cancelQueries({
                      queryKey: chatKeys.messages(room.id),
                    });
                    queryClient.removeQueries({ queryKey: chatKeys.room(room.id) });
                    queryClient.removeQueries({
                      queryKey: chatKeys.messages(room.id),
                    });

                    toast.success("Chat deleted");
                    queryClient.setQueryData(
                      chatKeys.joinedRooms(userId),
                      (prev: RoomListItem[] | undefined) =>
                        Array.isArray(prev) ? prev.filter((r) => r.id !== room.id) : prev,
                    );
                    return { error: false };
                  }}
                >
                  <Trash2Icon className="size-4" />
                </ActionButton>
              </div>
            );
          })
        )}
      </nav>

      <div className="border-t p-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start gap-2 text-muted-foreground"
          asChild
        >
          <Link href="/profile" className="flex items-center gap-2">
            <UserRoundIcon className="size-4" />
            Profile
          </Link>
        </Button>
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

