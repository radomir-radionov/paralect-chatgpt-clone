import {
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
  MAX_CHUNKS_PER_DOCUMENT,
} from "./constants";

/**
 * Splits plain text into overlapping windows for embedding.
 * Truncates to at most `maxChunks` segments to bound cost.
 */
export function chunkText(
  text: string,
  options?: { maxChunks?: number },
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const maxChunks = options?.maxChunks ?? MAX_CHUNKS_PER_DOCUMENT;
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length && chunks.length < maxChunks) {
    const end = Math.min(start + CHUNK_TARGET_CHARS, normalized.length);
    let slice = normalized.slice(start, end);
    if (end < normalized.length) {
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" "),
      );
      if (lastBreak > CHUNK_TARGET_CHARS * 0.4) {
        slice = normalized.slice(start, start + lastBreak + 1).trimEnd();
      }
    }
    if (slice.length === 0) {
      start = end;
      continue;
    }
    chunks.push(slice);
    const advance = Math.max(1, slice.length - CHUNK_OVERLAP_CHARS);
    start += advance;
  }

  return chunks;
}
