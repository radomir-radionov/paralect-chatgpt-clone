import { PDFParse } from "pdf-parse";

const MAX_BYTES = 2 * 1024 * 1024;

export async function extractTextFromBuffer(
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<string> {
  if (buffer.length > MAX_BYTES) {
    throw new Error("File too large (max 2MB for demo)");
  }
  const lower = filename.toLowerCase();
  if (mimeType === "text/plain" || lower.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text?.trim() ?? "";
    } finally {
      await parser.destroy();
    }
  }
  throw new Error("Unsupported file type (use .txt or .pdf)");
}
