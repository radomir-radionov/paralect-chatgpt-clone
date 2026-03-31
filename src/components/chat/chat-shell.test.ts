import assert from "node:assert/strict";
import test from "node:test";
import { getChatShellLayoutClasses } from "@/components/chat/chat-shell";

test("chat shell keeps the desktop sidebar fixed while the main pane scrolls", () => {
  const classes = getChatShellLayoutClasses();

  assert.equal(classes.root.includes("md:h-[100dvh]"), true);
  assert.equal(classes.root.includes("md:overflow-hidden"), true);
  assert.equal(classes.aside.includes("md:h-[100dvh]"), true);
  assert.equal(classes.main.includes("md:overflow-y-auto"), true);
});
