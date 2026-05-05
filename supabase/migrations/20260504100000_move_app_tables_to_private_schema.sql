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

-- App tables live in app_private; anon/authenticated cannot USE the schema, so PostgREST cannot expose them.
-- Data access from the Next.js API uses service_role + db.schema=app_private.

CREATE SCHEMA IF NOT EXISTS app_private;

GRANT USAGE ON SCHEMA app_private TO postgres;
GRANT USAGE ON SCHEMA app_private TO service_role;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
REVOKE ALL ON SCHEMA app_private FROM authenticated;

-- Reconcile split-brain states between public and app_private without dropping rows:
-- • Empty copies only in app_private → drop app_private shells, then ALTER … SET SCHEMA below.
-- • Rows only in app_private → DROP empty public tables (if any).
-- • Rows in both → INSERT … ON CONFLICT DO NOTHING merges into app_private, then DROP public copies.
DO $$
DECLARE
  rows_private bigint := 0;
  rows_public bigint := 0;
  n bigint;
BEGIN
  IF to_regclass('public.user_profile') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('app_private.user_profile') IS NULL
    AND to_regclass('app_private.chat_room') IS NULL
    AND to_regclass('app_private.message') IS NULL
    AND to_regclass('app_private.message_attachment') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('app_private.user_profile') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM app_private.user_profile' INTO n;
    rows_private := rows_private + n;
  END IF;
  IF to_regclass('app_private.chat_room') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM app_private.chat_room' INTO n;
    rows_private := rows_private + n;
  END IF;
  IF to_regclass('app_private.message') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM app_private.message' INTO n;
    rows_private := rows_private + n;
  END IF;
  IF to_regclass('app_private.message_attachment') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM app_private.message_attachment' INTO n;
    rows_private := rows_private + n;
  END IF;

  IF to_regclass('public.user_profile') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.user_profile' INTO n;
    rows_public := rows_public + n;
  END IF;
  IF to_regclass('public.chat_room') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.chat_room' INTO n;
    rows_public := rows_public + n;
  END IF;
  IF to_regclass('public.message') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.message' INTO n;
    rows_public := rows_public + n;
  END IF;
  IF to_regclass('public.message_attachment') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.message_attachment' INTO n;
    rows_public := rows_public + n;
  END IF;

  IF rows_private = 0 THEN
    DROP TABLE IF EXISTS app_private.message_attachment CASCADE;
    DROP TABLE IF EXISTS app_private.message CASCADE;
    DROP TABLE IF EXISTS app_private.chat_room CASCADE;
    DROP TABLE IF EXISTS app_private.user_profile CASCADE;
    RETURN;
  END IF;

  IF rows_public > 0 THEN
    IF to_regclass('public.user_profile') IS NOT NULL AND to_regclass('app_private.user_profile') IS NOT NULL THEN
      INSERT INTO app_private.user_profile
      SELECT * FROM public.user_profile
      ON CONFLICT (id) DO NOTHING;
    END IF;

    IF to_regclass('public.chat_room') IS NOT NULL AND to_regclass('app_private.chat_room') IS NOT NULL THEN
      INSERT INTO app_private.chat_room
      SELECT * FROM public.chat_room
      ON CONFLICT (id) DO NOTHING;
    END IF;

    IF to_regclass('public.message') IS NOT NULL AND to_regclass('app_private.message') IS NOT NULL THEN
      INSERT INTO app_private.message
      SELECT * FROM public.message
      ON CONFLICT (id) DO NOTHING;
    END IF;

    IF to_regclass('public.message_attachment') IS NOT NULL AND to_regclass('app_private.message_attachment') IS NOT NULL THEN
      INSERT INTO app_private.message_attachment
      SELECT * FROM public.message_attachment
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  DROP TABLE IF EXISTS public.message_attachment CASCADE;
  DROP TABLE IF EXISTS public.message CASCADE;
  DROP TABLE IF EXISTS public.chat_room CASCADE;
  DROP TABLE IF EXISTS public.user_profile CASCADE;
END $$;

-- Dependent tables after parents (FK order preserved when moving).
ALTER TABLE IF EXISTS public.user_profile SET SCHEMA app_private;
ALTER TABLE IF EXISTS public.chat_room SET SCHEMA app_private;
ALTER TABLE IF EXISTS public.message SET SCHEMA app_private;
ALTER TABLE IF EXISTS public.message_attachment SET SCHEMA app_private;

REVOKE ALL ON TABLE app_private.user_profile FROM PUBLIC;
REVOKE ALL ON TABLE app_private.user_profile FROM anon;
REVOKE ALL ON TABLE app_private.user_profile FROM authenticated;

REVOKE ALL ON TABLE app_private.chat_room FROM PUBLIC;
REVOKE ALL ON TABLE app_private.chat_room FROM anon;
REVOKE ALL ON TABLE app_private.chat_room FROM authenticated;

REVOKE ALL ON TABLE app_private.message FROM PUBLIC;
REVOKE ALL ON TABLE app_private.message FROM anon;
REVOKE ALL ON TABLE app_private.message FROM authenticated;

REVOKE ALL ON TABLE app_private.message_attachment FROM PUBLIC;
REVOKE ALL ON TABLE app_private.message_attachment FROM anon;
REVOKE ALL ON TABLE app_private.message_attachment FROM authenticated;

GRANT ALL ON TABLE app_private.user_profile TO postgres;
GRANT ALL ON TABLE app_private.user_profile TO service_role;

GRANT ALL ON TABLE app_private.chat_room TO postgres;
GRANT ALL ON TABLE app_private.chat_room TO service_role;

GRANT ALL ON TABLE app_private.message TO postgres;
GRANT ALL ON TABLE app_private.message TO service_role;

GRANT ALL ON TABLE app_private.message_attachment TO postgres;
GRANT ALL ON TABLE app_private.message_attachment TO service_role;

-- Replace SECURITY DEFINER trigger: no EXECUTE for anon/authenticated.
DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user_create_profile();

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
REVOKE ALL ON FUNCTION app_private.handle_new_auth_user_create_profile() FROM anon;
REVOKE ALL ON FUNCTION app_private.handle_new_auth_user_create_profile() FROM authenticated;

GRANT EXECUTE ON FUNCTION app_private.handle_new_auth_user_create_profile() TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION app_private.handle_new_auth_user_create_profile();

CREATE INDEX IF NOT EXISTS message_attachment_owner_id_idx
  ON app_private.message_attachment USING btree (owner_id);

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON TABLES FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON SEQUENCES FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app_private REVOKE ALL ON FUNCTIONS FROM authenticated;
