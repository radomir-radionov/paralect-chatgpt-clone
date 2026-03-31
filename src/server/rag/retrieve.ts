import { and, asc, eq, inArray } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { getDb } from "@/server/db";
import {
  documentChunks,
  documents,
  guestDocumentChunks,
  guestDocuments,
} from "@/server/db/schema";
import { RAG_TOP_K } from "./constants";
import { embedQuery } from "./embed";

function formatContext(chunks: { content: string; filename: string }[]): string {
  if (chunks.length === 0) return "";
  const parts = chunks.map(
    (c, i) =>
      `### Excerpt ${i + 1} (from "${c.filename}")\n${c.content}`,
  );
  return parts.join("\n\n");
}

export async function retrieveContextForUser(options: {
  userId: string;
  query: string;
  documentIds: string[];
}): Promise<string | undefined> {
  const { userId, query, documentIds } = options;
  if (documentIds.length === 0) return undefined;

  const qEmb = await embedQuery(query);
  const db = getDb();

  const rows = await db
    .select({
      content: documentChunks.content,
      filename: documents.filename,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.id, documentIds),
        eq(documents.status, "ready"),
      ),
    )
    .orderBy(asc(cosineDistance(documentChunks.embedding, qEmb)))
    .limit(RAG_TOP_K);

  const text = formatContext(rows);
  return text || undefined;
}

export async function retrieveContextForGuest(options: {
  sessionId: string;
  query: string;
  documentIds: string[];
}): Promise<string | undefined> {
  const { sessionId, query, documentIds } = options;
  if (documentIds.length === 0) return undefined;

  const qEmb = await embedQuery(query);
  const db = getDb();

  const rows = await db
    .select({
      content: guestDocumentChunks.content,
      filename: guestDocuments.filename,
    })
    .from(guestDocumentChunks)
    .innerJoin(
      guestDocuments,
      eq(guestDocumentChunks.documentId, guestDocuments.id),
    )
    .where(
      and(
        eq(guestDocuments.sessionId, sessionId),
        inArray(guestDocuments.id, documentIds),
        eq(guestDocuments.status, "ready"),
      ),
    )
    .orderBy(asc(cosineDistance(guestDocumentChunks.embedding, qEmb)))
    .limit(RAG_TOP_K);

  const text = formatContext(rows);
  return text || undefined;
}
