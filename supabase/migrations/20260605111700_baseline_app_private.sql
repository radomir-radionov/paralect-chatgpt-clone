-- Baseline: final app schema lives in app_private and is only accessible via service_role.
-- This replaces earlier incremental migrations (RLS policies, table moves, attachment evolutions).

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE SCHEMA IF NOT EXISTS app_private;

GRANT USAGE ON SCHEMA app_private TO postgres;
GRANT USAGE ON SCHEMA app_private TO service_role;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS "app_private"."user_profile" (
  "id" "uuid" NOT NULL,
  "name" "text" NOT NULL,
  "image_url" "text",
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "app_private"."user_profile" OWNER TO "postgres";

ALTER TABLE ONLY "app_private"."user_profile"
  ADD CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "app_private"."user_profile"
  ADD CONSTRAINT "user_profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "app_private"."chat_room" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "name" "text" NOT NULL,
  "is_public" boolean NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "owner_id" "uuid" NOT NULL,
  "model_slug" "text" DEFAULT 'openai:gpt-5-mini'::"text" NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "app_private"."chat_room" OWNER TO "postgres";

ALTER TABLE ONLY "app_private"."chat_room"
  ADD CONSTRAINT "chat_room_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "app_private"."chat_room"
  ADD CONSTRAINT "chat_room_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_private"."user_profile"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "chat_room_owner_id_last_message_at_idx"
  ON "app_private"."chat_room" USING "btree" ("owner_id", "last_message_at" DESC, "created_at" DESC);

CREATE TABLE IF NOT EXISTS "app_private"."message" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "text" "text" NOT NULL,
  "chat_room_id" "uuid" NOT NULL,
  "author_id" "uuid",
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "role" "text" NOT NULL,
  "error_message" "text",
  CONSTRAINT "message_author_id_role_check" CHECK (((("role" = 'user'::"text") AND ("author_id" IS NOT NULL)) OR ("role" = 'assistant'::"text"))),
  CONSTRAINT "message_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);

ALTER TABLE "app_private"."message" OWNER TO "postgres";

ALTER TABLE ONLY "app_private"."message"
  ADD CONSTRAINT "message_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "app_private"."message"
  ADD CONSTRAINT "message_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_private"."user_profile"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "app_private"."message"
  ADD CONSTRAINT "message_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "app_private"."chat_room"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "message_author_id_idx" ON "app_private"."message" USING "btree" ("author_id");
CREATE INDEX IF NOT EXISTS "message_chat_room_id_created_at_idx"
  ON "app_private"."message" USING "btree" ("chat_room_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "app_private"."message_attachment" (
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
  "original_name" "text",
  "extracted_text" "text",
  "extracted_chars" integer,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "message_attachment_kind_check" CHECK (("kind" = ANY (ARRAY['image'::"text", 'document'::"text"])))
);

ALTER TABLE "app_private"."message_attachment" OWNER TO "postgres";

ALTER TABLE ONLY "app_private"."message_attachment"
  ADD CONSTRAINT "message_attachment_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "app_private"."message_attachment"
  ADD CONSTRAINT "message_attachment_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "app_private"."message"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "app_private"."message_attachment"
  ADD CONSTRAINT "message_attachment_chat_room_id_fkey"
  FOREIGN KEY ("chat_room_id") REFERENCES "app_private"."chat_room"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "app_private"."message_attachment"
  ADD CONSTRAINT "message_attachment_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "app_private"."user_profile"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "message_attachment_chat_room_id_created_at_idx"
  ON "app_private"."message_attachment" USING "btree" ("chat_room_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "message_attachment_message_id_idx"
  ON "app_private"."message_attachment" USING "btree" ("message_id");
CREATE INDEX IF NOT EXISTS "message_attachment_message_id_created_at_idx"
  ON "app_private"."message_attachment" USING "btree" ("message_id", "created_at" ASC);
CREATE INDEX IF NOT EXISTS "message_attachment_owner_id_idx"
  ON "app_private"."message_attachment" USING "btree" ("owner_id");

REVOKE ALL ON TABLE app_private.user_profile FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app_private.chat_room FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app_private.message FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app_private.message_attachment FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE app_private.user_profile TO postgres, service_role;
GRANT ALL ON TABLE app_private.chat_room TO postgres, service_role;
GRANT ALL ON TABLE app_private.message TO postgres, service_role;
GRANT ALL ON TABLE app_private.message_attachment TO postgres, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.handle_new_auth_user_create_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $_$
declare
  profile_name text;
  profile_image_url text;
begin
  profile_name :=
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      new.email,
      ''
    );

  profile_image_url :=
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture',
        ''
      ),
      ''
    );

  insert into app_private.user_profile (id, name, image_url)
  values (new.id, profile_name, profile_image_url)
  on conflict (id) do nothing;

  return new;
end;
$_$;

ALTER FUNCTION app_private.handle_new_auth_user_create_profile() OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.handle_new_auth_user_create_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.handle_new_auth_user_create_profile() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION app_private.handle_new_auth_user_create_profile() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION app_private.handle_new_auth_user_create_profile();

INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit")
VALUES ('chat-attachments', 'chat-attachments', false, 15728640)
ON CONFLICT ("id") DO UPDATE
SET "public" = false,
    "file_size_limit" = 15728640;

