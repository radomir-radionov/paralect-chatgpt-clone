/** PNG, JPEG, WebP, GIF — used for server validation and client file input. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Max decoded image size per attachment (8 MiB). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** One image per user message keeps request bodies small and logic simple. */
export const MAX_IMAGES_PER_MESSAGE = 1;

const MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

export function isAllowedImageMimeType(mime: string): mime is AllowedImageMimeType {
  return MIME_SET.has(mime);
}

/** `accept` attribute for `<input type="file" />`. */
export const CHAT_IMAGE_ACCEPT_ATTR = ALLOWED_IMAGE_MIME_TYPES.join(",");

/** Approximate decoded byte length from base64 (ignores padding edge cases). */
export function base64DecodedByteLength(base64: string): number {
  const len = base64.length;
  if (len === 0) return 0;
  const padding =
    base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

export type ImageValidationError =
  | "type"
  | "size"
  | "empty";

export function validateImageFileMeta(file: {
  type: string;
  size: number;
}): ImageValidationError | null {
  if (!isAllowedImageMimeType(file.type)) return "type";
  if (file.size > MAX_IMAGE_BYTES) return "size";
  if (file.size === 0) return "empty";
  return null;
}

/** Client: validate before FileReader. Returns user-facing message or null if ok. */
export function assertImageFileClient(file: File): string | null {
  const err = validateImageFileMeta(file);
  if (err === "type") {
    return "Only PNG, JPEG, WebP, and GIF images are allowed.";
  }
  if (err === "size") {
    return `Image must be at most ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`;
  }
  if (err === "empty") {
    return "Image file is empty.";
  }
  return null;
}

/** Clipboard item: return a File if it is a single allowed image. */
export function getClipboardImageFile(item: DataTransferItem): File | null {
  if (item.kind !== "file") return null;
  const file = item.getAsFile();
  if (!file) return null;
  if (!isAllowedImageMimeType(file.type)) return null;
  return file;
}
