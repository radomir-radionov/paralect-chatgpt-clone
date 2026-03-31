import type { ChatMessageAttachment, ChatMessageRow } from "@/lib/chat-api";

export type ChatThreadRole = "user" | "assistant";

/**
 * - **Assistant:** always `text` (markdown body in `content`).
 * - **User:** `image` when the row has image attachments (current flow); `text` for
 *   legacy or text-only user rows (`content` is the visible message).
 */
export type ChatThreadMessageKind = "image" | "text";

/** Thread lifecycle: idle → sending → streaming → idle (success) or error. */
export type ChatThreadStatus =
  | "idle"
  | "sending"
  | "streaming"
  | "error";

export type ChatThreadMessageState = "complete" | "streaming" | "error";

export type ChatThreadMessage = {
  id: string;
  role: ChatThreadRole;
  messageType: ChatThreadMessageKind;
  content: string;
  createdAt: string;
  attachments?: ChatMessageAttachment[];
  state: ChatThreadMessageState;
  synced: boolean;
  errorMessage?: string;
};

export function toThreadMessage(row: ChatMessageRow): ChatThreadMessage {
  const isAssistant = row.role === "assistant";
  const hasImages = !!(row.attachments && row.attachments.length > 0);
  return {
    id: row.id,
    role: isAssistant ? "assistant" : "user",
    messageType: isAssistant ? "text" : hasImages ? "image" : "text",
    content: row.content,
    createdAt: row.createdAt,
    attachments: row.attachments ?? undefined,
    state: "complete",
    synced: true,
  };
}
