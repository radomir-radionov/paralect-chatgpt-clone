"use client";

import { cn } from "@shared/lib/utils";

export function ChatHeader({
  right,
  className,
}: {
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 shrink-0",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-base font-semibold truncate">AI Chat</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

