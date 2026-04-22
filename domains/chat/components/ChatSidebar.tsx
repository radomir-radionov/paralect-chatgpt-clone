"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LogOutIcon, MessageSquareIcon, PlusIcon, UserRoundIcon } from "lucide-react";

import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";

import { SignOutButton } from "@domains/auth/components/SignOutButton";
import { useJoinedRooms } from "@domains/chat/queries/useRooms";

export function ChatSidebar({ userId }: { userId: string }) {
  const params = useParams();
  const activeRoomId = params?.id as string | undefined;
  const { data: rooms = [] } = useJoinedRooms(userId);

  return (
    <aside className="flex flex-col w-64 border-r bg-muted/30 h-full shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Link
          href="/"
          className="font-semibold tracking-tight text-foreground text-sm"
        >
          Chat
        </Link>
        <Button variant="ghost" size="icon-sm" title="New room" asChild>
          <Link href="/rooms/new">
            <PlusIcon className="size-4" />
          </Link>
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {rooms.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-4 text-center">
            No rooms yet.{" "}
            <Link
              href="/rooms/new"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Create one
            </Link>
          </p>
        ) : (
          rooms.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.id}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                activeRoomId === room.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              <MessageSquareIcon className="size-4 shrink-0" />
              <span className="truncate">{room.name}</span>
            </Link>
          ))
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
