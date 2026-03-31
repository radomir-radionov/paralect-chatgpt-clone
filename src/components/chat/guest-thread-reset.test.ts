import assert from "node:assert/strict";
import test from "node:test";
import { clearGuestThreadState } from "@/components/chat/guest-thread-reset";

test("clearGuestThreadState removes the persisted guest thread snapshot", async () => {
  const removedKeys: string[] = [];
  const clearedKeys: string[] = [];

  await clearGuestThreadState(
    {
      removeItem(key) {
        removedKeys.push(key);
      },
    },
    {
      async clear(chatKey) {
        clearedKeys.push(chatKey);
      },
    },
  );

  assert.deepEqual(removedKeys, ["chat-thread-state:guest:default"]);
  assert.deepEqual(clearedKeys, ["guest:default"]);
});
