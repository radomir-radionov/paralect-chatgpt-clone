import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined;
};

export function getDb() {
  const { DATABASE_URL } = getServerEnv();
  if (!globalForDb.queryClient) {
    globalForDb.queryClient = postgres(DATABASE_URL, { max: 10 });
  }
  return drizzle(globalForDb.queryClient, { schema });
}

export { schema };
