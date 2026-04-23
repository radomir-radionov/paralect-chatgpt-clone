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
  error_message?: string | null;
};

export type MessageStatus = "pending" | "error" | "success";

export type PendingMessage = Message & { status: MessageStatus };

export type CachedMessage = Message & { status?: MessageStatus };
