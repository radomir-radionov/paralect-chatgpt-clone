import Image from "next/image";
import { User2Icon } from "lucide-react";
import type { Ref } from "react";

import { cn } from "@shared/lib/utils";

import type { Message, MessageStatus } from "@domains/chat/types/chat.types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

function hasImageUrl(imageUrl: string | null): imageUrl is string {
  return imageUrl != null && imageUrl.trim().length > 0;
}

export function ChatMessage({
  text,
  author,
  created_at,
  status,
  ref,
}: Message & {
  status?: MessageStatus;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex gap-4 px-4 py-2 hover:bg-accent/50",
        status === "pending" && "opacity-70",
        status === "error" && "bg-destructive/10 text-destructive",
      )}
    >
      <div className="shrink-0">
        {hasImageUrl(author.image_url) ? (
          <Image
            src={author.image_url}
            alt={author.name}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="size-10 rounded-full flex items-center justify-center border bg-muted text-muted-foreground overflow-hidden">
            <User2Icon className="size-[30px] mt-2.5" />
          </div>
        )}
      </div>
      <div className="grow space-y-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{author.name}</span>
          <span className="text-xs text-muted-foreground">
            {DATE_FORMATTER.format(new Date(created_at))}
          </span>
        </div>
        <p className="text-sm wrap-break-words whitespace-pre">{text}</p>
      </div>
    </div>
  );
}
