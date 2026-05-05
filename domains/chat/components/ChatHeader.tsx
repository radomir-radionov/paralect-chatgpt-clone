"use client";

import { MenuIcon } from "lucide-react";

import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";

import { useRoomsNavOptional } from "@domains/chat/context/RoomsNavContext";

export function ChatHeader({
  left,
  right,
  className,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const roomsNav = useRoomsNavOptional();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {left ??
          (roomsNav != null ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 md:hidden"
              onClick={() => roomsNav.openMobileSidebar()}
              aria-label="Open chats menu"
            >
              <MenuIcon className="size-4" />
            </Button>
          ) : null)}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-none tracking-tight">
            AI Chat
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{right}</div>
    </div>
  );
}

