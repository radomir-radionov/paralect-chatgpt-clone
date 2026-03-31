import assert from "node:assert/strict";
import test from "node:test";
import type { QueryClient } from "@tanstack/react-query";
import { reconcileAuthChatAfterStream } from "@/components/chat/chat-sync";

test("reconcileAuthChatAfterStream only refreshes the chats list", async () => {
  const invalidations: unknown[] = [];

  const queryClient = {
    invalidateQueries: async (filters: unknown) => {
      invalidations.push(filters);
    },
  } as unknown as QueryClient;

  reconcileAuthChatAfterStream({ queryClient });

  assert.equal(invalidations.length, 0);

  await new Promise((resolve) => setTimeout(resolve, 120));

  assert.deepEqual(invalidations, [{ queryKey: ["chats"] }]);
});
