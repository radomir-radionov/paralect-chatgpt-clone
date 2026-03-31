import { getServiceSupabase } from "@/server/supabase/service";
import { DOCUMENTS_BUCKET } from "@/server/rag/constants";

/** Ensures the private bucket exists (idempotent). */
export async function ensureDocumentsBucket(): Promise<void> {
  const supabase = getServiceSupabase();
  const { data: list } = await supabase.storage.listBuckets();
  if (list?.some((b) => b.name === DOCUMENTS_BUCKET)) return;
  const { error } = await supabase.storage.createBucket(DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: `${5 * 1024 * 1024}`,
  });
  if (error && !error.message?.includes("already exists")) {
    throw new Error(`Storage bucket: ${error.message}`);
  }
}

/**
 * Last path segment for Supabase Storage: ASCII-only (S3-style key rules reject many Unicode filenames).
 * Display name stays in DB `documents.filename`; this is only the object key.
 */
export function storageObjectFilename(documentId: string, displayFilename: string): string {
  const base = displayFilename.trim() || "document";
  const lastDot = base.lastIndexOf(".");
  const rawExt = lastDot >= 0 ? base.slice(lastDot + 1) : "";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  if (ext.length > 0) {
    return `${documentId}.${ext}`;
  }
  return documentId;
}

export function documentStoragePath(
  userId: string,
  documentId: string,
  filename: string,
): string {
  const safe = filename.replace(/[/\\]/g, "_").slice(0, 200);
  return `${userId}/${documentId}/${safe}`;
}

/** Upload bytes to a path already recorded in `documents.storage_path`. */
export async function uploadBytesToPath(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await ensureDocumentsBucket();
  const supabase = getServiceSupabase();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, body, {
      contentType,
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

export async function deleteUserDocumentObject(storagePath: string): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
}
