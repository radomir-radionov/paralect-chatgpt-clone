SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- App enforces ownership in Next.js API routes via service_role; drop RLS on app tables.

DROP POLICY IF EXISTS "Owners can manage chat rooms" ON "public"."chat_room";
ALTER TABLE IF EXISTS "public"."chat_room" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can insert their own user messages" ON "public"."message";
DROP POLICY IF EXISTS "Owners can view messages in their chat rooms" ON "public"."message";
ALTER TABLE IF EXISTS "public"."message" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON "public"."user_profile";
ALTER TABLE IF EXISTS "public"."user_profile" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view attachments in their chat rooms" ON "public"."message_attachment";
DROP POLICY IF EXISTS "Owners can insert attachments for their chat rooms" ON "public"."message_attachment";
ALTER TABLE IF EXISTS "public"."message_attachment" DISABLE ROW LEVEL SECURITY;

-- Private bucket: remove authenticated direct object policies; app uses service_role + signed URLs.
DROP POLICY IF EXISTS "Chat attachments: users can upload to their prefix" ON "storage"."objects";
DROP POLICY IF EXISTS "Chat attachments: users can read from their prefix" ON "storage"."objects";
