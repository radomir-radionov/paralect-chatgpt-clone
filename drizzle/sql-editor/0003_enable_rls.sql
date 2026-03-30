-- Same as drizzle/0003_enable_rls.sql — run in Supabase SQL Editor if you do not use `npm run db:migrate`.
-- Enables RLS on all public app tables so the Data API cannot access them without policies.
-- App server uses Drizzle with DATABASE_URL (bypasses RLS).

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."anonymous_quota" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."anonymous_documents" ENABLE ROW LEVEL SECURITY;
