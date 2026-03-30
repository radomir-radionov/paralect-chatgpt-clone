export type LlmMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  images?: { mimeType: string; base64: string }[];
};

export type ModelId = string;
