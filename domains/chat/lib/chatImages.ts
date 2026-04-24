export const CHAT_IMAGES_BUCKET = "chat-attachments";
export const CHAT_IMAGES_MAX_ATTACHMENTS = 4;
export const CHAT_IMAGES_MAX_BYTES = 10 * 1024 * 1024;

export function fileExtensionForMime(mime: string): string | null {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}

