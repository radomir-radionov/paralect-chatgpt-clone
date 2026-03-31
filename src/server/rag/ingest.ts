import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  documentChunks,
  documents,
  guestDocumentChunks,
  guestDocuments,
} from "@/server/db/schema";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";
import { extractTextFromBuffer } from "./parse";
import type { AllowedDocumentMimeType } from "./constants";

export async function ingestUserDocument(options: {
  documentId: string;
  buffer: Buffer;
  mimeType: AllowedDocumentMimeType;
}): Promise<void> {
  const { documentId, buffer, mimeType } = options;
  const db = getDb();

  try {
    const raw = await extractTextFromBuffer(buffer, mimeType);
    const chunks = chunkText(raw);
    if (chunks.length === 0) {
      await db
        .update(documents)
        .set({
          status: "failed",
          errorText: "No extractable text in file",
        })
        .where(eq(documents.id, documentId));
      return;
    }

    const vectors = await embedTexts(chunks);
    await db.insert(documentChunks).values(
      chunks.map((content, i) => ({
        documentId,
        chunkIndex: i,
        content,
        embedding: vectors[i]!,
      })),
    );

    await db
      .update(documents)
      .set({ status: "ready", errorText: null })
      .where(eq(documents.id, documentId));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Processing failed";
    await db
      .update(documents)
      .set({ status: "failed", errorText: message })
      .where(eq(documents.id, documentId));
  }
}

export async function ingestGuestDocument(options: {
  documentId: string;
  buffer: Buffer;
  mimeType: AllowedDocumentMimeType;
}): Promise<void> {
  const { documentId, buffer, mimeType } = options;
  const db = getDb();

  try {
    const raw = await extractTextFromBuffer(buffer, mimeType);
    const chunks = chunkText(raw);
    if (chunks.length === 0) {
      await db
        .update(guestDocuments)
        .set({
          status: "failed",
          errorText: "No extractable text in file",
        })
        .where(eq(guestDocuments.id, documentId));
      return;
    }

    const vectors = await embedTexts(chunks);
    await db.insert(guestDocumentChunks).values(
      chunks.map((content, i) => ({
        documentId,
        chunkIndex: i,
        content,
        embedding: vectors[i]!,
      })),
    );

    await db
      .update(guestDocuments)
      .set({ status: "ready", errorText: null })
      .where(eq(guestDocuments.id, documentId));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Processing failed";
    await db
      .update(guestDocuments)
      .set({ status: "failed", errorText: message })
      .where(eq(guestDocuments.id, documentId));
  }
}
