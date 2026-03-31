import { logDebugIngest } from "@/lib/debug-ingest";

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Not found");
    }
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: unknown };
      message =
        typeof j.error === "string"
          ? j.error
          : JSON.stringify(j.error ?? text);
    } catch {
      /* keep text */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function uploadLibraryDocument(
  path: "/api/documents" | "/api/guest/documents",
  file: File,
  options?: { chatId?: string },
): Promise<{ document: { id: string } }> {
  const fd = new FormData();
  fd.append("file", file);
  if (options?.chatId) {
    fd.append("meta", JSON.stringify({ chatId: options.chatId }));
  }
  const res = await fetch(path, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: unknown };
      if (typeof j.error === "string") message = j.error;
    } catch {
      /* keep text */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ document: { id: string } }>;
}

type SseEvent =
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message?: string };

type ParseSseStreamOptions = {
  onToken?: (chunk: string) => void;
  onDone?: () => void;
};

export async function parseSseStream(
  response: Response,
  options: ParseSseStreamOptions,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  logDebugIngest({
    sessionId: "d6f539",
    runId: "initial-debug",
    hypothesisId: "H1",
    location: "src/lib/api-client.ts:67",
    message: "parseSseStream started",
    data: {
      url: response.url,
      status: response.status,
      ok: response.ok,
    },
  });
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      const data = JSON.parse(json) as SseEvent;
      if (data.type === "token") {
        options.onToken?.(data.text);
      }
      if (data.type === "done") {
        sawDone = true;
        options.onDone?.();
      }
      if (data.type === "error") {
        logDebugIngest({
          sessionId: "d6f539",
          runId: "initial-debug",
          hypothesisId: "H1",
          location: "src/lib/api-client.ts:94",
          message: "parseSseStream received error event",
          data: {
            url: response.url,
            errorMessage: data.message ?? "Stream error",
          },
        });
        throw new Error(data.message ?? "Stream error");
      }
    }
  }

  if (!sawDone) {
    logDebugIngest({
      sessionId: "d6f539",
      runId: "initial-debug",
      hypothesisId: "H1",
      location: "src/lib/api-client.ts:100",
      message: "parseSseStream ended without done",
      data: {
        url: response.url,
        bufferLength: buffer.length,
      },
    });
    throw new Error("Streaming interrupted before completion. Please try again.");
  }
}
