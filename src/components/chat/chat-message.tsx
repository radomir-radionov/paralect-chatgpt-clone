"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { memo } from "react";
import { AssistantMarkdown } from "@/components/chat/assistant-markdown";
import type { ChatThreadMessage } from "@/components/chat/chat-thread.types";
import { cn } from "@/lib/utils";

type ChatMessageProps = {
  message: ChatThreadMessage;
};

export const ChatMessage = memo(function ChatMessage({
  message,
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const isStreaming = isAssistant && message.state === "streaming";
  const isErrored = isAssistant && message.state === "error";

  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
        isAssistant
          ? "bg-muted text-foreground"
          : "bg-primary text-primary-foreground",
      )}
      aria-busy={isStreaming || undefined}
    >
      {message.attachments && message.attachments.length > 0 && (
        <div
          className={cn(
            "mb-2 flex flex-col gap-2",
            message.content ? "" : "mb-0",
          )}
        >
          {message.attachments.map((attachment, index) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`${message.id}-att-${index}`}
              src={`data:${attachment.mimeType};base64,${attachment.base64}`}
              alt=""
              className="max-h-64 max-w-full rounded-md object-contain"
            />
          ))}
        </div>
      )}

      {message.content ? (
        isAssistant ? (
          <AssistantMarkdown content={message.content} />
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )
      ) : isStreaming ? (
        <span className="text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Thinking...
        </span>
      ) : null}

      {isErrored && (
        <div className="text-destructive mt-3 inline-flex items-start gap-2 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{message.errorMessage ?? "Streaming interrupted."}</span>
        </div>
      )}
    </div>
  );
});
