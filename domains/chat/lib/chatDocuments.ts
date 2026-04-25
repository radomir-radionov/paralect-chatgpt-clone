export const CHAT_DOCUMENTS_BUCKET = "chat-attachments";
export const CHAT_DOCUMENTS_MAX_ATTACHMENTS = 2;
export const CHAT_DOCUMENTS_MAX_BYTES = 15 * 1024 * 1024;
export const CHAT_DOCUMENT_CONTEXT_MAX_CHARS_PER_DOCUMENT = 12_000;
export const CHAT_DOCUMENT_CONTEXT_MAX_CHARS_PER_MESSAGE = 24_000;

export const CHAT_DOCUMENT_ACCEPT = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".md",
  ".rtf",
].join(",");

const EXTENSION_BY_MIME = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["text/plain", "txt"],
  ["text/markdown", "md"],
  ["text/csv", "csv"],
  ["text/html", "html"],
  ["application/rtf", "rtf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-powerpoint", "ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
]);

const SUPPORTED_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "html",
  "htm",
  "md",
  "pdf",
  "ppt",
  "pptx",
  "rtf",
  "txt",
  "xls",
  "xlsx",
]);

export function fileExtensionForDocument(file: Pick<File, "name" | "type">): string | null {
  const fromMime = EXTENSION_BY_MIME.get(file.type);
  if (fromMime) return fromMime;

  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext && SUPPORTED_EXTENSIONS.has(ext) ? ext : null;
}

export function isSupportedChatDocument(file: Pick<File, "name" | "type">): boolean {
  return fileExtensionForDocument(file) != null;
}
