"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  LogOutIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ActionButton } from "@shared/components/ui/action-button";
import { Button } from "@shared/components/ui/button";
import { AiKnotMark } from "@shared/assets/AiKnotMark";
import { cn } from "@shared/lib/utils";

import { SignOutButton } from "@domains/auth/components/SignOutButton";
import { useDeleteRoom } from "@domains/chat/mutations/useDeleteRoom";
import { useJoinedRooms } from "@domains/chat/queries/useRooms";

export function ChatSidebar({ userId }: { userId: string }) {
  const router = useRouter();
  const params = useParams();
  const activeRoomId = params?.id as string | undefined;
  const { data: rooms = [] } = useJoinedRooms(userId);
  const deleteRoomMutation = useDeleteRoom(userId);

  return (
    <aside className="flex flex-col w-64 border-r bg-muted/30 h-full shrink-0">
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

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {rooms.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-4 text-center">
            No chats yet.{" "}
            <Link
              href="/"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Start one
            </Link>
          </p>
        ) : (
          rooms.map((room) => {
            return (
              <div
                key={room.id}
                className={cn(
                  "group relative px-3 py-2 rounded-md text-sm transition-colors",
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
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    "text-destructive hover:text-destructive hover:bg-destructive/10",
                  )}
                  disabled={deleteRoomMutation.isPending}
                  action={async () => {
                    const result = await deleteRoomMutation.mutateAsync({
                      roomId: room.id,
                    });
                    if (result.error) return result;

                    toast.success("Chat deleted");
                    if (activeRoomId === room.id) {
                      router.push("/");
                    }
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
          <Link href="/profile">
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
    </aside>
  );
}
