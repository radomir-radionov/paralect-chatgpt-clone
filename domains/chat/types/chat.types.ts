export type Message = {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  author: {
    name: string;
    image_url: string | null;
  };
};

export type MessageStatus = "pending" | "error" | "success";

export type PendingMessage = Message & { status: MessageStatus };

export type CachedMessage = Message & { status?: MessageStatus };
