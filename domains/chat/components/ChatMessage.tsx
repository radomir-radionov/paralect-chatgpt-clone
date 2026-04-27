 "use client";

import type { Ref } from "react";
import { FileTextIcon, ImageOffIcon } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@shared/lib/utils";

import type { Message, MessageAttachment, MessageStatus } from "@domains/chat/types/chat.types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeStyle: "short",
});

type Props = Message & {
  roomId?: string;
  isOwn: boolean;
  isGrouped?: boolean;
  status?: MessageStatus;
  ref?: Ref<HTMLDivElement>;
};

export function ChatMessage({
  text,
  roomId,
  author,
  created_at,
  status,
  error_message,
  attachments,
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

  const renderAttachments = (items: MessageAttachment[] | undefined) => {
    if (!items || items.length === 0) return null;
    const imageItems = items.filter((a) => a.kind === "image");
    const documentItems = items.filter((a) => a.kind === "document");

    const ImageThumb = ({
      src,
      linkHref,
      label,
    }: {
      src: string;
      linkHref?: string;
      label: string;
    }) => {
      const [failed, setFailed] = useState(false);
      const isLocalPreview = src.startsWith("blob:") || src.startsWith("data:");

      const thumb = failed ? (
        <span
          className={cn(
            "flex h-32 w-32 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg",
            "border border-border/60 bg-muted/20 text-white",
          )}
          aria-label={`${label} (not available)`}
          title="Image is no longer available"
        >
          <ImageOffIcon className="size-5 opacity-80" />
          <span className="text-[11px] font-medium leading-none">
            Image unavailable
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "block h-32 w-32 overflow-hidden rounded-lg",
            "border border-border/60 bg-muted/40",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            loading={isLocalPreview ? "eager" : "lazy"}
            fetchPriority={isLocalPreview ? "high" : "auto"}
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        </span>
      );

      return linkHref ? (
        <a
          href={linkHref}
          target="_blank"
          rel="noreferrer"
          className="block"
          aria-label={label}
        >
          {thumb}
        </a>
      ) : (
        <span className="block" aria-label={label}>
          {thumb}
        </span>
      );
    };

    return (
      <div className="mb-2 flex flex-wrap gap-2">
        {imageItems.map((a) => {
            const src =
              a.preview_url ?? (roomId ? `/api/rooms/${roomId}/attachments/${a.id}` : null);
            if (!src) return null;
            const linkHref = roomId ? src : undefined;
            return (
              <ImageThumb
                key={a.id}
                src={src}
                linkHref={linkHref}
                label={roomId ? "Open image" : "Attached image"}
              />
            );
          })}
        {documentItems.map((a) => {
          const label = a.original_name?.trim() || "Document";
          return roomId ? (
            <a
              key={a.id}
              href={`/api/rooms/${roomId}/attachments/${a.id}`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex max-w-64 items-center gap-2 rounded-lg border border-border/60",
                "bg-background/60 px-2.5 py-2 text-current hover:bg-background/80",
              )}
              aria-label={`Open ${label}`}
            >
              <FileTextIcon className="size-4 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </a>
          ) : (
            <span
              key={a.id}
              className={cn(
                "flex max-w-64 items-center gap-2 rounded-lg border border-border/60",
                "bg-background/60 px-2.5 py-2 text-current",
              )}
              aria-label={`Attached ${label}`}
            >
              <FileTextIcon className="size-4 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </span>
          );
        })}
      </div>
    );
  };

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
          {renderAttachments(attachments)}
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
        {renderAttachments(attachments)}
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
