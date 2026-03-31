import assert from "node:assert/strict";
import test from "node:test";
import { logDebugIngest } from "@/lib/debug-ingest";

test("logDebugIngest does nothing when no ingest url is configured", () => {
  const originalUrl = process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  const originalFetch = globalThis.fetch;
  let called = false;

  delete process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  globalThis.fetch = (async () => {
    called = true;
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  logDebugIngest({
    sessionId: "session-1",
    runId: "run-1",
    hypothesisId: "H1",
    location: "src/lib/debug-ingest.test.ts",
    message: "should not send",
  });

  assert.equal(called, false);

  globalThis.fetch = originalFetch;
  if (originalUrl) {
    process.env.NEXT_PUBLIC_DEBUG_INGEST_URL = originalUrl;
  }
});

test("logDebugIngest ignores blank ingest urls", () => {
  const originalUrl = process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  const originalFetch = globalThis.fetch;
  let called = false;

  process.env.NEXT_PUBLIC_DEBUG_INGEST_URL = "   ";
  globalThis.fetch = (async () => {
    called = true;
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  logDebugIngest({
    sessionId: "session-1",
    runId: "run-1",
    hypothesisId: "H1",
    location: "src/lib/debug-ingest.test.ts",
    message: "should not send",
  });

  assert.equal(called, false);

  globalThis.fetch = originalFetch;
  if (originalUrl) {
    process.env.NEXT_PUBLIC_DEBUG_INGEST_URL = originalUrl;
  } else {
    delete process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  }
});

test("logDebugIngest posts payload when ingest url is configured", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  const originalSession = process.env.NEXT_PUBLIC_DEBUG_SESSION_ID;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_DEBUG_INGEST_URL = "http://127.0.0.1:7271/ingest/test";
  process.env.NEXT_PUBLIC_DEBUG_SESSION_ID = "debug-session";
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  logDebugIngest({
    sessionId: "session-1",
    runId: "run-1",
    hypothesisId: "H1",
    location: "src/lib/debug-ingest.test.ts",
    message: "should send",
    data: { count: 1 },
    timestamp: 123,
  });

  await Promise.resolve();

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://127.0.0.1:7271/ingest/test");
  assert.deepEqual(requests[0]?.init?.headers, {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "debug-session",
  });
  assert.equal(
    requests[0]?.init?.body,
    JSON.stringify({
      sessionId: "session-1",
      runId: "run-1",
      hypothesisId: "H1",
      location: "src/lib/debug-ingest.test.ts",
      message: "should send",
      data: { count: 1 },
      timestamp: 123,
    }),
  );

  globalThis.fetch = originalFetch;
  if (originalUrl) {
    process.env.NEXT_PUBLIC_DEBUG_INGEST_URL = originalUrl;
  } else {
    delete process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  }
  if (originalSession) {
    process.env.NEXT_PUBLIC_DEBUG_SESSION_ID = originalSession;
  } else {
    delete process.env.NEXT_PUBLIC_DEBUG_SESSION_ID;
  }
});

test("logDebugIngest swallows payload serialization errors", () => {
  const originalUrl = process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  const originalFetch = globalThis.fetch;
  let called = false;

  process.env.NEXT_PUBLIC_DEBUG_INGEST_URL = "http://127.0.0.1:7271/ingest/test";
  globalThis.fetch = (async () => {
    called = true;
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  assert.doesNotThrow(() => {
    logDebugIngest({
      sessionId: "session-1",
      runId: "run-1",
      hypothesisId: "H1",
      location: "src/lib/debug-ingest.test.ts",
      message: "should not throw",
      data: { count: 1n },
    });
  });
  assert.equal(called, false);

  globalThis.fetch = originalFetch;
  if (originalUrl) {
    process.env.NEXT_PUBLIC_DEBUG_INGEST_URL = originalUrl;
  } else {
    delete process.env.NEXT_PUBLIC_DEBUG_INGEST_URL;
  }
});
