import { MessageSquareIcon } from "lucide-react";
import Link from "next/link";

export default function RoomsIndexPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <div className="rounded-full bg-muted p-4">
        <MessageSquareIcon className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No chat selected</h2>
        <p className="text-sm text-muted-foreground">
          Pick a chat from the sidebar or{" "}
          <Link
            href="/rooms/new"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            start a new one
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
