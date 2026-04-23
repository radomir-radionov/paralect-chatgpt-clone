import type { Ref } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@shared/lib/utils";

import type { Message, MessageStatus } from "@domains/chat/types/chat.types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeStyle: "short",
});

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
  error_message,
  isOwn,
  isGrouped = false,
  ref,
}: Props) {
  const isPending = status === "pending";
  const isError = status === "error";
  const rawText = text ?? "";
  const fallbackError =
    typeof error_message === "string" && error_message.trim().length > 0
      ? error_message
      : "Something went wrong while generating a response.";

  const content =
    !isOwn && isPending && rawText.trim().length === 0
      ? "Thinking…"
      : !isOwn && isError && rawText.trim().length === 0
        ? fallbackError
        : rawText;

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
          <p className="wrap-break-words whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-start px-4",
        isGrouped ? "pt-0.5" : "pt-3",
      )}
    >
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
          "max-w-[70%] rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm",
          "bg-accent text-accent-foreground",
          isPending && "opacity-60",
          isError && "bg-destructive/10 text-destructive",
        )}
      >
        <div
          className={cn(
            "wrap-break-word leading-relaxed",
            "[&>p:not(:first-child)]:mt-2",
            "[&>ul]:my-1.5 [&>ul]:list-disc [&>ul]:pl-5",
            "[&>ol]:my-1.5 [&>ol]:list-decimal [&>ol]:pl-5",
            "[&>ul>li]:my-0.5 [&>ol>li]:my-0.5",
            "[&>ul>li>p]:m-0 [&>ol>li>p]:m-0",
            "[&>pre]:my-2 [&>pre]:overflow-x-auto [&>pre]:rounded-lg [&>pre]:bg-muted [&>pre]:p-3",
            "[&>pre>code]:text-xs",
            "[&>code]:rounded [&>code]:bg-muted [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:text-[0.85em]",
            "[&>blockquote]:border-l-2 [&>blockquote]:border-border [&>blockquote]:pl-3 [&>blockquote]:text-muted-foreground",
            "[&>a]:underline [&>a]:underline-offset-4",
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
