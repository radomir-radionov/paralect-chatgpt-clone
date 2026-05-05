export type PersistedHistoryRow = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export type PersistedAttachmentRow = {
  id: string;
  message_id: string;
  kind: "image" | "document";
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  original_name: string | null;
  extracted_text: string | null;
  extracted_chars: number | null;
};

export type StreamIncomingAttachment = {
  id: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  kind?: "image" | "document";
  originalName?: string;
};

export type ParsedStreamIncomingDocument = {
  extractedText: string;
  extractedChars: number;
};
