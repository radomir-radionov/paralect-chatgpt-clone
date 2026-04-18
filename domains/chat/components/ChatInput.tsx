"use client";

import { SendIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@shared/components/ui/input-group";

import { useSendMessage } from "@domains/chat/mutations/useSendMessage";
import type { Message } from "@domains/chat/types/chat.types";

type Props = {
  roomId: string;
  author: {
    id: string;
    name: string;
    image_url: string | null;
  };
  onSuccessfulSend?: (message: Message) => void;
};

export function ChatInput({ roomId, author, onSuccessfulSend }: Props) {
  const [message, setMessage] = useState("");
  const sendMessage = useSendMessage();

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = message.trim();
    if (!text) return;

    setMessage("");
    const id = crypto.randomUUID();
    const result = await sendMessage.mutateAsync({
      id,
      text,
      roomId,
      author,
    });

    if (result.error) {
      toast.error(result.message);
    } else {
      onSuccessfulSend?.(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3">
      <InputGroup>
        <InputGroupTextarea
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="field-sizing-content min-h-auto"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="submit"
            aria-label="Send"
            title="Send"
            size="icon-sm"
          >
            <SendIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
