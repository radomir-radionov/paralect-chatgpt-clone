import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeGuestQuestion,
  GUEST_FREE_QUESTION_LIMIT,
  readGuestQuotaCookie,
} from "./guestQuota.ts";

const SECRET = "test-secret";
const NOW = new Date("2026-04-25T12:00:00.000Z");

test("allows exactly three guest questions and then blocks the fourth", async () => {
  let cookieValue = null;

  for (let index = 1; index <= GUEST_FREE_QUESTION_LIMIT; index += 1) {
    const result = await consumeGuestQuestion({
      cookieValue,
      secret: SECRET,
      now: NOW,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.remaining, GUEST_FREE_QUESTION_LIMIT - index);
    cookieValue = result.cookieValue;
  }

  const blocked = await consumeGuestQuestion({
    cookieValue,
    secret: SECRET,
    now: NOW,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test("treats a tampered guest quota cookie as exhausted", async () => {
  const quota = await readGuestQuotaCookie("tampered-cookie", SECRET, NOW);

  assert.equal(quota.usedQuestions, GUEST_FREE_QUESTION_LIMIT);
  assert.equal(quota.remaining, 0);
});
