import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import type { AllowedDocumentMimeType } from "./constants";

/** pdfjs fake worker must load a real `pdf.worker.mjs`; Turbopack bundles break the default path. */
function ensurePdfJsWorkerSrc(): void {
  const require = createRequire(import.meta.url);
  const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
  const workerPath = join(pdfjsRoot, "legacy/build/pdf.worker.mjs");
  PDFParse.setWorker(pathToFileURL(workerPath).href);
}

ensurePdfJsWorkerSrc();

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: AllowedDocumentMimeType,
): Promise<string> {
  switch (mimeType) {
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf8");
    case "application/pdf": {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return result.text ?? "";
      } finally {
        await parser.destroy();
      }
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? "";
    }
  }
}
