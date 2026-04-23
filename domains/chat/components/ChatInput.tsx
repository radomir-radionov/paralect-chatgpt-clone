"use client";

import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@shared/components/ui/input-group";

import { useSendMessage } from "@domains/chat/mutations/useSendMessage";

const MAX_LENGTH = 2000;

type Props = {
  roomId: string;
  author: {
    id: string;
    name: string;
    image_url: string | null;
  };
};

export function ChatInput({ roomId, author }: Props) {
  const [message, setMessage] = useState("");
  const sendMessage = useSendMessage();
  const remaining = MAX_LENGTH - message.length;
  const isOverLimit = remaining < 0;
  const showCounter = remaining <= 200;

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = message.trim();
    if (!text || sendMessage.isPending || isOverLimit) return;

    setMessage("");
    const id = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const result = await sendMessage.mutateAsync({
      id,
      assistantId,
      text,
      roomId,
      createdAt,
      author,
    });

    if (result.error) {
      toast.error(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 border-t shrink-0">
      <InputGroup>
        <InputGroupTextarea
          placeholder="Ask anything…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="field-sizing-content min-h-auto max-h-40"
          disabled={sendMessage.isPending}
          aria-invalid={isOverLimit || undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <InputGroupAddon align="inline-end" className="self-end pb-1.5">
          {showCounter && (
            <span
              className={
                isOverLimit
                  ? "text-xs text-destructive font-medium"
                  : "text-xs text-muted-foreground"
              }
            >
              {remaining}
            </span>
          )}
          <InputGroupButton
            type="submit"
            aria-label="Send"
            title="Send (Enter)"
            size="icon-sm"
            disabled={sendMessage.isPending || !message.trim() || isOverLimit}
          >
            {sendMessage.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SendIcon />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="mt-1.5 text-xs text-muted-foreground/60 hidden sm:block">
        Enter to send · Shift+Enter for new line
      </p>
    </form>
  );
}
