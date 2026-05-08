-- Drop unused column: chat rooms are personal threads only.
ALTER TABLE IF EXISTS app_private.chat_room
  DROP COLUMN IF EXISTS is_public;

