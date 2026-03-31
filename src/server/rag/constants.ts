/** Gemini embedding model (Google AI Studio) — must match `vector(768)` columns. */
export const EMBEDDING_MODEL = "text-embedding-004" as const;
export const EMBEDDING_DIMENSIONS = 768;

export const CHUNK_TARGET_CHARS = 1000;
export const CHUNK_OVERLAP_CHARS = 150;
/** Hard cap to limit embedding cost per document. */
export const MAX_CHUNKS_PER_DOCUMENT = 500;

/** Retrieved chunks per chat turn. */
export const RAG_TOP_K = 8;

/** Max selected document IDs per message (client + server). */
export const MAX_DOCUMENT_IDS_PER_MESSAGE = 8;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const DOCUMENTS_BUCKET = "user-documents";

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export function isAllowedDocumentMimeType(
  mime: string,
): mime is AllowedDocumentMimeType {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}
