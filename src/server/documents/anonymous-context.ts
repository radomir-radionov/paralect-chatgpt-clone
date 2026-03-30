import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { anonymousDocuments } from "@/server/db/schema";

export async function loadAnonymousDocumentContext(
  sessionId: string,
  ids?: string[],
): Promise<string | undefined> {
  if (!ids?.length) return undefined;
  const db = getDb();
  const rows = await db.query.anonymousDocuments.findMany({
    where: and(
      eq(anonymousDocuments.sessionId, sessionId),
      inArray(anonymousDocuments.id, ids),
    ),
  });
  if (!rows.length) return undefined;
  return rows
    .map((r) => `--- ${r.filename} ---\n${r.textContent}`)
    .join("\n\n");
}
