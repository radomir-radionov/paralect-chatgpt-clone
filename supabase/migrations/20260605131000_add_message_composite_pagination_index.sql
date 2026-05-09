-- Support stable composite cursor pagination by (created_at, id).

CREATE INDEX IF NOT EXISTS "message_chat_room_id_created_at_id_idx"
  ON "app_private"."message" USING "btree" ("chat_room_id", "created_at" DESC, "id" DESC);

