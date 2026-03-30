-- Enable RLS so PostgREST (anon/authenticated) cannot read/write app tables.
-- Server access via DATABASE_URL uses a role that bypasses RLS (Supabase postgres / service patterns).
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "anonymous_quota" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "anonymous_documents" ENABLE ROW LEVEL SECURITY;
