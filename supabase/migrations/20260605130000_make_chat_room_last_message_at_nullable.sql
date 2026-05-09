-- Make chat_room.last_message_at nullable so brand-new rooms can be detected.
-- This supports SSR behavior that skips message prefetch until the first message is persisted.

ALTER TABLE app_private.chat_room
  ALTER COLUMN last_message_at DROP DEFAULT,
  ALTER COLUMN last_message_at DROP NOT NULL;

