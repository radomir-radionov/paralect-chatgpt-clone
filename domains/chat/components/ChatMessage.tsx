import Image from "next/image";
import { User2Icon } from "lucide-react";
import type { Ref } from "react";

import { cn } from "@shared/lib/utils";

import type { Message, MessageStatus } from "@domains/chat/types/chat.types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeStyle: "short",
});

function hasImageUrl(imageUrl: string | null): imageUrl is string {
  return imageUrl != null && imageUrl.trim().length > 0;
}

type Props = Message & {
  isOwn: boolean;
  isGrouped?: boolean;
  status?: MessageStatus;
  ref?: Ref<HTMLDivElement>;
};

export function ChatMessage({
  text,
  author,
  created_at,
  status,
  isOwn,
  isGrouped = false,
  ref,
}: Props) {
  const isPending = status === "pending";
  const isError = status === "error";

  if (isOwn) {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-end px-4", isGrouped ? "pt-0.5" : "pt-3")}
      >
        {!isGrouped && (
          <span className="text-xs text-muted-foreground mb-1 pr-1">
            {DATE_FORMATTER.format(new Date(created_at))}
          </span>
        )}
        <div
          className={cn(
            "max-w-[70%] rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm",
            "bg-primary text-primary-foreground",
            isPending && "opacity-60",
            isError && "bg-destructive text-white",
          )}
        >
          <p className="wrap-break-words whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-end gap-2.5 px-4",
        isGrouped ? "pt-0.5" : "pt-3",
      )}
    >
      {/* Avatar column — always reserves space to keep bubbles aligned */}
      <div className="size-8 shrink-0">
        {!isGrouped &&
          (hasImageUrl(author.image_url) ? (
            <Image
              src={author.image_url}
              alt={author.name}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="size-8 rounded-full flex items-center justify-center border bg-muted text-muted-foreground overflow-hidden">
              <User2Icon className="size-[22px] mt-2" />
            </div>
          ))}
      </div>

      <div className="flex flex-col items-start max-w-[70%]">
        {!isGrouped && (
          <div className="flex items-baseline gap-1.5 mb-1 pl-0.5">
            <span className="text-xs font-semibold">{author.name}</span>
            <span className="text-xs text-muted-foreground">
              {DATE_FORMATTER.format(new Date(created_at))}
            </span>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm",
            "bg-accent text-accent-foreground",
            isPending && "opacity-60",
            isError && "bg-destructive/10 text-destructive",
          )}
        >
          <p className="wrap-break-words whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    </div>
  );
}
