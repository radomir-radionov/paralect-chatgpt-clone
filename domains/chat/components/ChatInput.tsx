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

import { sendMessage } from "@domains/chat/actions/messages";
import type { Message } from "@domains/chat/types/chat.types";

type Props = {
  roomId: string;
  onSend: (message: { id: string; text: string }) => void;
  onSuccessfulSend: (message: Message) => void;
  onErrorSend: (id: string) => void;
};

export function ChatInput({
  roomId,
  onSend,
  onSuccessfulSend,
  onErrorSend,
}: Props) {
  const [message, setMessage] = useState("");

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = message.trim();
    if (!text) return;

    setMessage("");
    const id = crypto.randomUUID();
    onSend({ id, text });
    const result = await sendMessage({ id, text, roomId });
    if (result.error) {
      toast.error(result.message);
      onErrorSend(id);
    } else {
      onSuccessfulSend(result.message);
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
