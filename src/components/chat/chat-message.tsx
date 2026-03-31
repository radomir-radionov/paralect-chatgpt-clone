"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { memo } from "react";
import { AssistantMarkdown } from "@/components/chat/assistant-markdown";
import type { ChatThreadMessage } from "@/components/chat/chat-thread.types";
import { USER_IMAGE_PROMPT } from "@/lib/chat-prompts";
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
  const isUser = message.role === "user";

  if (isUser) {
    const hasImages = !!(message.attachments && message.attachments.length > 0);
    const isImageMessage = message.messageType === "image";
    const textToShow =
      message.messageType === "text" && message.content.trim().length > 0
        ? message.content
        : isImageMessage &&
            hasImages &&
            message.content.trim().length > 0 &&
            message.content !== USER_IMAGE_PROMPT
          ? message.content
          : null;

    return (
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          "bg-primary text-primary-foreground",
        )}
      >
        {hasImages && (
          <div className="flex flex-col gap-2">
            {message.attachments!.map((attachment, index) => (
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
        {textToShow !== null && (
          <span
            className={cn(
              "whitespace-pre-wrap",
              hasImages ? "mt-2 block" : "",
            )}
          >
            {textToShow}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
        "bg-muted text-foreground",
      )}
      aria-busy={isStreaming || undefined}
    >
      {message.content ? (
        <AssistantMarkdown content={message.content} />
      ) : isStreaming ? (
        <span className="text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Thinking...
        </span>
      ) : null}

      {isErrored && (
        <div className="text-destructive mt-3 inline-flex items-start gap-2 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {message.errorMessage ??
              "Streaming interrupted before completion. Please try again."}
          </span>
        </div>
      )}
    </div>
  );
});
