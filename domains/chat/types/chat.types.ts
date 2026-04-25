export type MessageAttachment = {
  id: string;
  kind: "image" | "document";
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  original_name?: string | null;
  extracted_text?: string | null;
  extracted_chars?: number | null;
  /**
   * Client-only: used for optimistic messages to show local previews before the
   * corresponding `message_attachment` row exists and `/api/.../attachments/:id`
   * can resolve.
   */
  preview_url?: string;
};

export type Message = {
  id: string;
  text: string;
  created_at: string;
  author_id: string | null;
  role: "assistant" | "user";
  author: {
    name: string;
    image_url: string | null;
  };
  attachments?: MessageAttachment[];
  error_message?: string | null;
};

export type MessageStatus = "pending" | "error" | "success";

export type PendingMessage = Message & { status: MessageStatus };

export type CachedMessage = Message & { status?: MessageStatus };
