import assert from "node:assert/strict";
import test from "node:test";

import { parseGuestMessagesForStream } from "./guestStreamPayload.ts";

test("parses v1 payload (messages[]) and enforces last message is user", () => {
  const ok = parseGuestMessagesForStream({
    modelSlug: "openai:gpt-4.1-mini",
    messages: [
      { role: "assistant", text: "Hi" },
      { role: "user", text: "Hello" },
    ],
  });

  assert.ok(ok);
  assert.equal(ok.at(-1)?.role, "user");

  const bad = parseGuestMessagesForStream({
    modelSlug: "openai:gpt-4.1-mini",
    messages: [{ role: "assistant", text: "No user message" }],
  });
  assert.equal(bad, null);
});

test("parses v2 payload (text + optional history) and appends the user message", () => {
  const parsed = parseGuestMessagesForStream({
    modelSlug: "openai:gpt-4.1-mini",
    text: "   new question   ",
    history: [{ role: "assistant", text: "Prior answer" }],
  });

  assert.deepEqual(parsed, [
    { role: "assistant", text: "Prior answer" },
    { role: "user", text: "new question" },
  ]);
});

test("rejects v2 payload with empty text", () => {
  const parsed = parseGuestMessagesForStream({
    modelSlug: "openai:gpt-4.1-mini",
    text: "   ",
    history: [{ role: "assistant", text: "Prior answer" }],
  });

  assert.equal(parsed, null);
});

