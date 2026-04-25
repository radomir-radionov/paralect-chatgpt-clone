
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

-- Message attachments (images) + private storage bucket

CREATE TABLE IF NOT EXISTS "public"."message_attachment" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "message_id" "uuid" NOT NULL,
  "chat_room_id" "uuid" NOT NULL,
  "owner_id" "uuid" NOT NULL,
  "kind" "text" NOT NULL DEFAULT 'image'::"text",
  "storage_bucket" "text" NOT NULL DEFAULT 'chat-attachments'::"text",
  "storage_path" "text" NOT NULL,
  "mime_type" "text" NOT NULL,
  "size_bytes" bigint NOT NULL,
  "width" integer,
  "height" integer,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "message_attachment_kind_check" CHECK (("kind" = 'image'::"text"))
);

ALTER TABLE "public"."message_attachment" OWNER TO "postgres";

ALTER TABLE ONLY "public"."message_attachment"
  ADD CONSTRAINT "message_attachment_pkey" PRIMARY KEY ("id");

CREATE INDEX "message_attachment_chat_room_id_created_at_idx"
  ON "public"."message_attachment" USING "btree" ("chat_room_id", "created_at" DESC);

CREATE INDEX "message_attachment_message_id_idx"
  ON "public"."message_attachment" USING "btree" ("message_id");

ALTER TABLE ONLY "public"."message_attachment"
  ADD CONSTRAINT "message_attachment_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."message_attachment"
  ADD CONSTRAINT "message_attachment_chat_room_id_fkey"
  FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_room"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."message_attachment"
  ADD CONSTRAINT "message_attachment_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "public"."user_profile"("id") ON DELETE CASCADE;

CREATE POLICY "Owners can view attachments in their chat rooms"
  ON "public"."message_attachment" FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."chat_room"
      WHERE "chat_room"."id" = "message_attachment"."chat_room_id"
        AND "chat_room"."owner_id" = (SELECT "auth"."uid"() AS "uid")
    )
  );

CREATE POLICY "Owners can insert attachments for their chat rooms"
  ON "public"."message_attachment" FOR INSERT TO "authenticated"
  WITH CHECK (
    "owner_id" = (SELECT "auth"."uid"() AS "uid")
    AND EXISTS (
      SELECT 1
      FROM "public"."chat_room"
      WHERE "chat_room"."id" = "message_attachment"."chat_room_id"
        AND "chat_room"."owner_id" = (SELECT "auth"."uid"() AS "uid")
    )
  );

ALTER TABLE "public"."message_attachment" ENABLE ROW LEVEL SECURITY;

-- Storage bucket for chat images (private)
INSERT INTO "storage"."buckets" ("id", "name", "public")
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT ("id") DO UPDATE SET "public" = false;

-- Restrict storage objects to per-user prefix: {auth.uid()}/...
-- This assumes object names are stored as: "{ownerId}/{roomId}/{messageId}/{attachmentId}.ext"
CREATE POLICY "Chat attachments: users can upload to their prefix"
  ON "storage"."objects" FOR INSERT TO "authenticated"
  WITH CHECK (
    "bucket_id" = 'chat-attachments'
    AND (storage.foldername("name"))[1] = (SELECT "auth"."uid"()::text AS "uid")
  );

CREATE POLICY "Chat attachments: users can read from their prefix"
  ON "storage"."objects" FOR SELECT TO "authenticated"
  USING (
    "bucket_id" = 'chat-attachments'
    AND (storage.foldername("name"))[1] = (SELECT "auth"."uid"()::text AS "uid")
  );

GRANT ALL ON TABLE "public"."message_attachment" TO "anon";
GRANT ALL ON TABLE "public"."message_attachment" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachment" TO "service_role";

