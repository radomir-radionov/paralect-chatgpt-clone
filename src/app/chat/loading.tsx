import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-sidebar-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="ml-auto h-9 w-32" />
      </header>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <Skeleton className="h-16 w-[80%]" />
        <Skeleton className="h-16 w-[70%] self-end" />
        <Skeleton className="h-16 w-[75%]" />
      </div>
    </div>
  );
}
