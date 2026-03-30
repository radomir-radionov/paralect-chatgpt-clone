import type { ChatMessageAttachment, ChatMessageRow } from "@/lib/chat-api";

export type ChatThreadRole = "user" | "assistant";

export type ChatThreadStatus =
  | "idle"
  | "sending"
  | "streaming"
  | "done"
  | "error";

export type ChatThreadMessageState = "complete" | "streaming" | "error";

export type ChatThreadMessage = {
  id: string;
  role: ChatThreadRole;
  content: string;
  createdAt: string;
  attachments?: ChatMessageAttachment[];
  state: ChatThreadMessageState;
  synced: boolean;
  errorMessage?: string;
};

export function toThreadMessage(row: ChatMessageRow): ChatThreadMessage {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    createdAt: row.createdAt,
    attachments: row.attachments ?? undefined,
    state: "complete",
    synced: true,
  };
}
