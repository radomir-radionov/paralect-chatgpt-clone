import {
  isAllowedDocumentMimeType,
  MAX_UPLOAD_BYTES,
  type AllowedDocumentMimeType,
} from "@/server/rag/constants";

export class DocumentUploadError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DocumentUploadError";
    this.status = status;
  }
}

export function sanitizeDocumentFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim() || "document";
  return base.slice(0, 200);
}

export async function parseDocumentUpload(request: Request): Promise<{
  file: File;
  buffer: Buffer;
  filename: string;
  mimeType: AllowedDocumentMimeType;
}> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new DocumentUploadError("Missing file field", 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DocumentUploadError("File too large (max 5 MB)", 413);
  }

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedDocumentMimeType(mimeType)) {
    throw new DocumentUploadError("Unsupported file type", 400);
  }

  return {
    file,
    buffer: Buffer.from(await file.arrayBuffer()),
    filename: sanitizeDocumentFilename(file.name),
    mimeType,
  };
}
