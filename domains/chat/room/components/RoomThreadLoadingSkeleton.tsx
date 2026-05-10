import { Skeleton } from "@shared/components/ui/skeleton";

import { ChatHeader } from "@domains/chat/room/components/ChatHeader";

export function RoomThreadLoadingSkeleton() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col">
      <ChatHeader right={<Skeleton className="h-9 w-[min(220px,55vw)]" />} />

      <div
        className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6"
        aria-busy="true"
        role="status"
      >
        <span className="sr-only">Loading…</span>
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-16 w-[min(100%,28rem)]" />
          <Skeleton className="h-16 w-[min(100%,24rem)] self-end" />
          <Skeleton className="h-20 w-[min(100%,26rem)]" />
        </div>
        <Skeleton className="h-14 w-full max-w-3xl self-center" />
      </div>
    </div>
  );
}
