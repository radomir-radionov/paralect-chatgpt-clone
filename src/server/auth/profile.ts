import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { profiles } from "@/server/db/schema";

export async function ensureProfile(userId: string, email: string | undefined) {
  const db = getDb();
  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  if (existing) return existing;
  await db
    .insert(profiles)
    .values({ id: userId, email: email ?? null })
    .onConflictDoNothing();
  return db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
}
