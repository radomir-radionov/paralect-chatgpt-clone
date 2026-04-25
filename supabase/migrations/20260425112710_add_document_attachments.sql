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

-- Extend chat attachments from image-only files to image + document files.

ALTER TABLE ONLY "public"."message_attachment"
  DROP CONSTRAINT IF EXISTS "message_attachment_kind_check";

ALTER TABLE ONLY "public"."message_attachment"
  ADD CONSTRAINT "message_attachment_kind_check"
  CHECK (("kind" = ANY (ARRAY['image'::"text", 'document'::"text"])));

ALTER TABLE "public"."message_attachment"
  ADD COLUMN IF NOT EXISTS "original_name" "text",
  ADD COLUMN IF NOT EXISTS "extracted_text" "text",
  ADD COLUMN IF NOT EXISTS "extracted_chars" integer;

UPDATE "storage"."buckets"
SET "file_size_limit" = 15728640
WHERE "id" = 'chat-attachments';
