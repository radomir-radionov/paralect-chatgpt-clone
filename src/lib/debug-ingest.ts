export type DebugIngestEvent = {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: unknown;
  timestamp?: number;
};

export function logDebugIngest(event: DebugIngestEvent) {
  const ingestUrl = process.env.NEXT_PUBLIC_DEBUG_INGEST_URL?.trim();
  if (!ingestUrl || typeof fetch !== "function") {
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const debugSessionId = process.env.NEXT_PUBLIC_DEBUG_SESSION_ID;
  if (debugSessionId) {
    headers["X-Debug-Session-Id"] = debugSessionId;
  }

  let body: string;
  try {
    body = JSON.stringify({
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    });
  } catch {
    return;
  }

  void fetch(ingestUrl, {
    method: "POST",
    headers,
    body,
  }).catch(() => {});
}
